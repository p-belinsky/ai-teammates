"use server"

import { auth } from "@clerk/nextjs/server"

import { getUsageSummary, isWithinBudget } from "@/lib/usage"

// Checked before a message is sent, so the person sees the limit right away instead of a failed reply
export async function checkUsageAllowed() {
  const { userId } = await auth.protect()

  return isWithinBudget(await getUsageSummary(userId))
}
