"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { usePlanGate } from "@/hooks/use-plan-gate"
import { cn } from "cn"

type VncSlotName = "panel" | "dialog"

type ChatVncContextValue = {
  error: boolean
  loaded: boolean
  reconnect: () => void
  attach: (name: VncSlotName, element: HTMLElement) => void
  detach: (name: VncSlotName) => void
}

const ChatVncContext = React.createContext<ChatVncContextValue | null>(null)

function useChatVnc() {
  const context = React.useContext(ChatVncContext)
  if (!context) {
    throw new Error("useChatVnc must be used within ChatVncProvider")
  }
  return context
}

// Owns the one VNC iframe for the chat. It is never moved in the DOM (that would reload it);
// instead it is positioned over whichever slot is active: the dialog when open, else the panel.
function ChatVncProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  const slots = React.useRef<Partial<Record<VncSlotName, HTMLElement>>>({})
  const hostRef = React.useRef<HTMLDivElement>(null)
  const requested = React.useRef(false)
  const [src, setSrc] = React.useState<string | null>(null)
  const [error, setError] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const [body, setBody] = React.useState<HTMLElement | null>(null)
  const { showUpgrade } = usePlanGate()

  React.useEffect(() => {
    setBody(document.body)
  }, [])

  React.useEffect(() => {
    let frame = 0

    const track = () => {
      const host = hostRef.current
      if (host) {
        const name = slots.current.dialog
          ? "dialog"
          : slots.current.panel
            ? "panel"
            : null
        const element = name ? slots.current[name] : undefined

        if (name && element) {
          const rect = element.getBoundingClientRect()
          Object.assign(host.style, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            visibility: "visible",
            // The panel preview is a button that opens the dialog, so only the dialog takes input
            pointerEvents: name === "dialog" ? "auto" : "none",
          })
        } else {
          host.style.visibility = "hidden"
        }
      }

      frame = requestAnimationFrame(track)
    }

    frame = requestAnimationFrame(track)
    return () => cancelAnimationFrame(frame)
  }, [])

  const connect = React.useCallback(() => {
    fetch(`/api/chats/${chatId}/vnc`)
      .then(async (response) => {
        if (!response.ok) {
          // The route answers 403 when the account has no paid plan, so say why
          if (response.status === 403) showUpgrade()
          throw new Error("Couldn't connect to the desktop")
        }
        const { url } = (await response.json()) as { url: string }
        setSrc(url)
      })
      .catch(() => setError(true))
  }, [chatId, showUpgrade])

  const attach = React.useCallback(
    (name: VncSlotName, element: HTMLElement) => {
      slots.current[name] = element

      // Fetch the URL on first use only, so the desktop loads once per chat
      if (requested.current) return
      requested.current = true
      connect()
    },
    [connect]
  )

  const detach = React.useCallback((name: VncSlotName) => {
    delete slots.current[name]
  }, [])

  const reconnect = React.useCallback(() => {
    setError(false)
    setLoaded(false)
    connect()
  }, [connect])

  return (
    <ChatVncContext.Provider
      value={{ error, loaded, reconnect, attach, detach }}
    >
      {children}
      {src &&
        body &&
        createPortal(
          <div ref={hostRef} className="fixed z-[60]">
            <iframe
              src={src}
              title="Desktop"
              allow="clipboard-read; clipboard-write"
              scrolling="no"
              className="size-full border-0"
              onLoad={() => setLoaded(true)}
            />
          </div>,
          body
        )}
    </ChatVncContext.Provider>
  )
}

type VncSlotProps = {
  name: VncSlotName
  className?: string
  children?: React.ReactNode
}

// Reserves a spot where the VNC iframe is drawn. The iframe itself lives in ChatVncProvider.
function VncSlot({ name, className, children }: VncSlotProps) {
  const { error, loaded, attach, detach } = useChatVnc()
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    attach(name, element)
    return () => detach(name)
  }, [name, attach, detach])

  return (
    <div ref={ref} className={cn("relative size-full min-h-0", className)}>
      {error ? (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>Couldn&apos;t connect to the desktop</AlertDescription>
        </Alert>
      ) : (
        !loaded && <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {children}
    </div>
  )
}

export { ChatVncProvider, VncSlot, useChatVnc }
