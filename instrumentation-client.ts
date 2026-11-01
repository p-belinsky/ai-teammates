import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 100% in dev, 10% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Record every session in dev, 10% in production, and every session that hits an error
  replaysSessionSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Browser-only: must stay in this file, never in the server or edge configs
  integrations: [Sentry.replayIntegration()],
})

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
