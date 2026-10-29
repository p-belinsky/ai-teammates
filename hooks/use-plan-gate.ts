"use client"

import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useCallback } from "react"

import { useToastManager } from "@/components/ui/toast"
import {
  canUseBots,
  canUseSandboxes,
  HasFeature,
  PRICING_PATH,
  UPGRADE_MESSAGE,
} from "@/lib/billing"

const USAGE_PATH = "/usage"

// Each require check returns true when the account can use that part of the app.
// A blocked check shows a toast that links to the page where the person can act on it.
export function usePlanGate() {
  const { has } = useAuth()
  const toastManager = useToastManager()
  const router = useRouter()

  const showUpgrade = useCallback(() => {
    toastManager.add({
      type: "error",
      title: "Upgrade to keep going",
      description: UPGRADE_MESSAGE,
      actionProps: {
        children: "See plans",
        onClick: () => router.push(PRICING_PATH),
      },
    })
  }, [toastManager, router])

  const showUsageLimit = useCallback(() => {
    toastManager.add({
      type: "error",
      title: "Usage limit reached",
      description:
        "This period's budget is used up. It resets at the end of your billing period.",
      actionProps: {
        children: "View usage",
        onClick: () => router.push(USAGE_PATH),
      },
    })
  }, [toastManager, router])

  // Until Clerk has loaded the session there is no has() to check, so treat it as blocked
  const requireFeature = useCallback(
    (canUse: (has: HasFeature) => boolean) => {
      const allowed = has ? canUse(has) : false
      if (!allowed) showUpgrade()

      return allowed
    },
    [has, showUpgrade]
  )

  return {
    showUpgrade,
    showUsageLimit,
    requireBots: useCallback(
      () => requireFeature(canUseBots),
      [requireFeature]
    ),
    requireSandboxes: useCallback(
      () => requireFeature(canUseSandboxes),
      [requireFeature]
    ),
  }
}
