"use client"

import { format, formatDistanceStrict } from "date-fns"
import { useEffect, useState } from "react"

// Counts down to the reset, refreshed every minute
export function ResetCountdown({ resetsAt }: { resetsAt: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const end = new Date(resetsAt)

  return (
    <p className="text-sm text-muted-foreground" suppressHydrationWarning>
      Resets {formatDistanceStrict(end, now, { addSuffix: true })} on{" "}
      {format(end, "PPP")}
    </p>
  )
}
