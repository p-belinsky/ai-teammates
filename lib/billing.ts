// Feature slugs from Clerk Dashboard → Billing → Plans. The paid plan includes both.
export const BOTS_FEATURE = "bots"
export const SANDBOXES_FEATURE = "sandboxes"

export const PRICING_PATH = "/pricing"
export const UPGRADE_MESSAGE =
  "Upgrade to a paid plan to use bots and sandboxes"

// The part of Clerk's has() these checks need, so the server and the client share them
export type HasFeature = (params: { feature: string }) => boolean

// Talking to a bot runs in its sandbox, so bots need both features
export function canUseBots(has: HasFeature) {
  return has({ feature: BOTS_FEATURE }) && has({ feature: SANDBOXES_FEATURE })
}

export function canUseSandboxes(has: HasFeature) {
  return has({ feature: SANDBOXES_FEATURE })
}
