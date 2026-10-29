import { createClerkClient } from "@clerk/nextjs/server"
import type { LanguageModelUsage } from "ai"
import { and, eq, sql } from "drizzle-orm"
import { AsyncLocalStorage } from "node:async_hooks"

import { daytona } from "./daytona"
import { db } from "./db"
import { usageBalances, usageEvents } from "./db/schema"

// Budgets per billing period on the paid plan. Tokens are counted in micro-dollars (millionths of a dollar).
export const AI_TOKEN_BUDGET = 10_000_000 // $10.00
export const SANDBOX_BUDGET = 50 * 60 * 60 // 50 hours, in seconds

// claude-sonnet-5 costs $2 per million input tokens and $10 per million output tokens.
// A micro-dollar per token is $1 per million tokens, so the per-token prices are 2 and 10.
const INPUT_MICRODOLLARS_PER_TOKEN = 2
const OUTPUT_MICRODOLLARS_PER_TOKEN = 10

// Also covers a failed plan lookup, which fails closed, so the message can't blame only the budget
export const USAGE_LIMIT_MESSAGE =
  "This period's budget is used up, or we couldn't confirm your billing period. Check your usage for details."

export type Meter = "ai_tokens" | "sandbox_seconds"

export const LIMITS: Record<Meter, number> = {
  ai_tokens: AI_TOKEN_BUDGET,
  sandbox_seconds: SANDBOX_BUDGET,
}

export type UsagePeriod = { start: Date; end: Date }

export type UsageSummary = {
  period: UsagePeriod | null
  meters: Record<Meter, { used: number; limit: number }>
}

// The period comes from the active subscription item. Session claims don't carry it.
export async function getCurrentPeriod(
  userId: string
): Promise<UsagePeriod | null> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  // Fails closed: if Clerk can't answer, there's no period and so no budget
  const subscription = await clerk.billing
    .getUserBillingSubscription(userId)
    .catch(() => null)
  const item = subscription?.subscriptionItems.find(
    (item) => item.status === "active"
  )
  if (!item || item.periodEnd === null) return null

  // Clerk sends the period as Unix milliseconds
  return { start: new Date(item.periodStart), end: new Date(item.periodEnd) }
}

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const period = await getCurrentPeriod(userId)
  const used: Record<Meter, number> = { ai_tokens: 0, sandbox_seconds: 0 }

  if (period) {
    const balances = await db
      .select({ meter: usageBalances.meter, used: usageBalances.used })
      .from(usageBalances)
      .where(
        and(
          eq(usageBalances.userId, userId),
          eq(usageBalances.periodStart, period.start)
        )
      )

    for (const balance of balances) used[balance.meter] = balance.used
  }

  return {
    period,
    meters: {
      ai_tokens: { used: used.ai_tokens, limit: LIMITS.ai_tokens },
      sandbox_seconds: {
        used: used.sandbox_seconds,
        limit: LIMITS.sandbox_seconds,
      },
    },
  }
}

// Soft cap: a turn is refused only when it starts past a budget, so the last turn can take it over
export function isWithinBudget(summary: UsageSummary) {
  return (
    summary.period !== null &&
    Object.values(summary.meters).every((meter) => meter.used < meter.limit)
  )
}

// Stops a turn from starting with no period or past the budget. Returns the period it's charged to.
export async function assertWithinBudget(userId: string): Promise<UsagePeriod> {
  const summary = await getUsageSummary(userId)
  if (!summary.period || !isWithinBudget(summary)) {
    throw new Error(USAGE_LIMIT_MESSAGE)
  }

  return summary.period
}

export function tokenCostMicros(usage: LanguageModelUsage) {
  return (
    (usage.inputTokens ?? 0) * INPUT_MICRODOLLARS_PER_TOKEN +
    (usage.outputTokens ?? 0) * OUTPUT_MICRODOLLARS_PER_TOKEN
  )
}

type Charge = {
  userId: string
  period: UsagePeriod
  meter: Meter
  amount: number
  reference: string
}

const RECORD_ATTEMPTS = 3

// A transient database error is retried, because a charge that never lands is lost for good
async function recordCharge(charge: Charge): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await writeCharge(charge)
    } catch (error) {
      if (attempt >= RECORD_ATTEMPTS) throw error
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }
}

// A reference that was already recorded is skipped, so a retried step is never charged twice
async function writeCharge({
  userId,
  period,
  meter,
  amount,
  reference,
}: Charge) {
  if (amount <= 0) return

  await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(usageEvents)
      .values({
        userId,
        meter,
        amount,
        periodStart: period.start,
        reference,
      })
      .onConflictDoNothing({ target: usageEvents.reference })
      .returning({ id: usageEvents.id })

    if (!event) return

    await tx
      .insert(usageBalances)
      .values({
        userId,
        meter,
        periodStart: period.start,
        used: amount,
      })
      .onConflictDoUpdate({
        target: [
          usageBalances.userId,
          usageBalances.meter,
          usageBalances.periodStart,
        ],
        set: { used: sql`${usageBalances.used} + ${amount}` },
      })
  })
}

// Sandboxes used inside a metered turn, each with the time it was first used
const sandboxClocks = new AsyncLocalStorage<Map<string, number>>()

// Called before a sandbox is used. Only a metered turn keeps a clock, so other uses pass through.
export function startSandboxClock(sandboxId: string) {
  const clocks = sandboxClocks.getStore()
  if (clocks && !clocks.has(sandboxId)) clocks.set(sandboxId, Date.now())
}

// Stops the sandbox so it stops billing, then charges the seconds since it was first used.
// Without a period there is nothing to charge, but the sandbox is still stopped.
export async function stopAndRecordSandbox({
  userId,
  period,
  sandboxId,
  startedAt,
  reference,
}: {
  userId: string
  period: UsagePeriod | null
  sandboxId: string
  startedAt: number
  reference: string
}) {
  try {
    const sandbox = await daytona.get(sandboxId)
    await sandbox.stop()
  } catch (error) {
    // Auto-stop still ends it, so only the idle tail goes uncharged
    console.error("Couldn't stop sandbox", { sandboxId, error })
  }

  if (!period) return

  await recordCharge({
    userId,
    period,
    meter: "sandbox_seconds",
    amount: Math.ceil((Date.now() - startedAt) / 1000),
    reference: `${reference}:sandbox:${sandboxId}`,
  })
}

export type TurnMeter = {
  tokens: (step: string, usage: LanguageModelUsage) => void
}

// Runs one chat turn and meters it: tokens from each model step, and the time each sandbox ran.
// `reference` names the turn, so a retried turn records every charge once.
export async function meterTurn<T>(
  {
    userId,
    period,
    reference,
  }: { userId: string; period: UsagePeriod; reference: string },
  turn: (meter: TurnMeter) => Promise<T>
): Promise<T> {
  const clocks = new Map<string, number>()
  const charges: Promise<unknown>[] = []

  const meter: TurnMeter = {
    tokens: (step, usage) => {
      charges.push(
        recordCharge({
          userId,
          period,
          meter: "ai_tokens",
          amount: tokenCostMicros(usage),
          reference: `${reference}:${step}`,
        }).catch((error) => console.error("Couldn't record tokens", error))
      )
    },
  }

  try {
    return await sandboxClocks.run(clocks, () => turn(meter))
  } finally {
    // Runs even when the turn fails or is stopped, so the time already used is still charged
    await Promise.all([
      ...[...clocks].map(([sandboxId, startedAt]) =>
        stopAndRecordSandbox({
          userId,
          period,
          sandboxId,
          startedAt,
          reference,
        }).catch((error) => console.error("Couldn't record sandbox", error))
      ),
      ...charges,
    ])
  }
}
