"use client"

import * as React from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"

import { cn } from "cn"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type ChatLayoutContextValue = {
  desktopOpen: boolean
  toggleDesktop: () => void
}

const ChatLayoutContext = React.createContext<ChatLayoutContextValue | null>(
  null
)

function useChatLayout() {
  const context = React.useContext(ChatLayoutContext)
  if (!context) {
    throw new Error("useChatLayout must be used within ChatLayout")
  }
  return context
}

type ChatLayoutProps = {
  children: React.ReactNode
  panel?: React.ReactNode
}

function ChatLayout({ children, panel }: ChatLayoutProps) {
  const [desktopOpen, setDesktopOpen] = React.useState(false)
  const desktopRef = React.useRef<PanelImperativeHandle | null>(null)

  // Judge by the current size, not isCollapsed(): a panel that starts at 0 isn't flagged collapsed
  const toggleDesktop = React.useCallback(() => {
    const desktop = desktopRef.current
    if (!desktop) return

    if (desktop.getSize().asPercentage > 0) {
      desktop.collapse()
    } else {
      desktop.resize("30%")
    }
  }, [])

  return (
    <ChatLayoutContext.Provider value={{ desktopOpen, toggleDesktop }}>
      {/* Inline height: the library sets height: 100% inline, which would override a class */}
      <ResizablePanelGroup
        orientation="horizontal"
        style={{ height: "100svh" }}
      >
        <ResizablePanel
          defaultSize="100"
          minSize="50"
          className="flex min-w-0 flex-col"
          style={{ overflow: "hidden" }}
        >
          {children}
        </ResizablePanel>
        <ResizableHandle withHandle className={cn(!desktopOpen && "hidden")} />
        <ResizablePanel
          panelRef={desktopRef}
          defaultSize="0"
          minSize="20"
          maxSize="50"
          collapsible
          collapsedSize="0"
          onResize={(size) => setDesktopOpen(size.asPercentage > 0)}
          className="flex flex-col"
          style={{ overflow: "hidden" }}
        >
          {desktopOpen && panel}
        </ResizablePanel>
      </ResizablePanelGroup>
    </ChatLayoutContext.Provider>
  )
}

export { ChatLayout, useChatLayout }
