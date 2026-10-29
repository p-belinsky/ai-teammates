import { auth } from "@clerk/nextjs/server"
import Link from "next/link"
import { Suspense } from "react"

import { Progress, ProgressLabel } from "@/components/ui/progress"
import { ResetCountdown } from "@/components/usage-reset-countdown"
import { canUseBots } from "@/lib/billing"
import { getUsageSummary, type UsageSummary } from "@/lib/usage"

// Reached from the user menu, so it is not linked from the sidebar
export default function UsagePage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Suspense>
        <UsageDetails />
      </Suspense>
    </main>
  )
}

async function UsageDetails() {
  const { userId, has } = await auth.protect()

  if (!canUseBots(has)) {
    return (
      <p className="text-sm">
        Usage is part of the paid plan. <Link href="/pricing">See plans</Link>
      </p>
    )
  }

  const { period, meters } = await getUsageSummary(userId)

  if (!period) {
    return (
      <p className="text-sm">There&apos;s no active billing period to show.</p>
    )
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Usage</h1>
      <UsageMeter
        label="AI model tokens"
        meter={meters.ai_tokens}
        used={formatUsd(meters.ai_tokens.used)}
        limit={formatUsd(meters.ai_tokens.limit)}
      />
      <UsageMeter
        label="Sandbox time"
        meter={meters.sandbox_seconds}
        used={formatHours(meters.sandbox_seconds.used)}
        limit={formatHours(meters.sandbox_seconds.limit)}
      />
      <ResetCountdown resetsAt={period.end.toISOString()} />
    </div>
  )
}

function UsageMeter({
  label,
  meter,
  used,
  limit,
}: {
  label: string
  meter: UsageSummary["meters"][keyof UsageSummary["meters"]]
  used: string
  limit: string
}) {
  const percent = Math.min(100, (meter.used / meter.limit) * 100)

  return (
    <Progress value={percent}>
      <div className="flex w-full items-center justify-between">
        <ProgressLabel>{label}</ProgressLabel>
        <span className="text-sm text-muted-foreground tabular-nums">
          {used} of {limit}
        </span>
      </div>
    </Progress>
  )
}

// Tokens are kept in micro-dollars, so a million of them is one dollar
function formatUsd(microDollars: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(microDollars / 1_000_000)
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)} h`
}
