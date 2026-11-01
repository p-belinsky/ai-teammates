"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"

import { getUsageSummary, isWithinBudget } from "@/lib/usage"

// Checked before a message is sent, so the person sees the limit right away instead of a failed reply
export async function checkUsageAllowed() {
  const { userId } = await auth.protect()

  const allowed = isWithinBudget(await getUsageSummary(userId))
  if (!allowed) {
    Sentry.logger.warn("Message blocked by usage limit", { userId })
  }

  return allowed
}
