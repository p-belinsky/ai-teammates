import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs/config"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The Daytona SDK loads busboy with a dynamic require, which Next's bundler can't follow
  serverExternalPackages: ["@daytona/sdk"],
}

export default withSentryConfig(nextConfig, {
  org: "phil-belinsky-6i",
  project: "ai-teammates",
  // Source map upload token, build-time only (SENTRY_AUTH_TOKEN)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload wider set of client files for better stack trace resolution
  widenClientFileUpload: true,
  // Proxy events through the app to bypass ad-blockers
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
})
