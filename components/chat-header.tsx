"use client"

import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { useChatLayout } from "@/components/chat-layout"
import { Button } from "@/components/ui/button"
import type { bots } from "@/lib/db/schema"

type ChatHeaderProps = {
  chat: {
    name: string
    bot: typeof bots.$inferSelect | null
  }
}

function ChatHeader({ chat }: ChatHeaderProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const { desktopOpen, toggleDesktop } = useChatLayout()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
      {chat.bot ? (
        <>
          <Button
            variant="ghost"
            className="h-9 min-w-0 justify-start px-2"
            onClick={() => setEditOpen(true)}
          >
            <ChatAvatar seed={chat.bot.avatar} className="shrink-0" />
            <span className="truncate text-sm font-medium">{chat.name}</span>
          </Button>
          <BotDialog
            bot={chat.bot}
            open={editOpen}
            onOpenChange={setEditOpen}
            showTrigger={false}
          />
        </>
      ) : (
        <span className="truncate text-sm font-medium">{chat.name}</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Desktop"
        aria-pressed={desktopOpen}
        onClick={toggleDesktop}
      >
        <MonitorIcon />
      </Button>
    </header>
  )
}

export { ChatHeader }
