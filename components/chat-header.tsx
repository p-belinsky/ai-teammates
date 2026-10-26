"use client"

import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { useChatLayout } from "@/components/chat-layout"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { bots } from "@/lib/db/schema"

type ChatHeaderProps = {
  chat: {
    kind: "direct" | "group"
    name: string
    bot: typeof bots.$inferSelect | null
    bots: (typeof bots.$inferSelect)[]
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
        <div className="flex min-w-0 items-center gap-2 px-2">
          <GroupChatAvatar
            seeds={chat.bots.map((bot) => bot.avatar)}
            className="shrink-0"
          />
          <span className="truncate text-sm font-medium">{chat.name}</span>
        </div>
      )}
      {/* Group chats have no desktop: each message is answered by a different bot */}
      {chat.kind === "direct" && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Desktop"
          aria-pressed={desktopOpen}
          onClick={toggleDesktop}
        >
          <MonitorIcon />
        </Button>
      )}
    </header>
  )
}

export { ChatHeader }
