"use client"

import * as React from "react"
import { MonitorIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { useChatLayout } from "@/components/chat-layout"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { bots } from "@/lib/db/schema"
import type { UserBot } from "@/queries/bots"

type ChatHeaderProps = {
  chat: {
    id: string
    kind: "direct" | "group"
    name: string
    bot: typeof bots.$inferSelect | null
    bots: (typeof bots.$inferSelect)[]
  }
  // Every bot the user has, so a group chat can add one when it's edited
  userBots: UserBot[]
}

function ChatHeader({ chat, userBots }: ChatHeaderProps) {
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
        <>
          <Button
            variant="ghost"
            className="h-9 min-w-0 justify-start px-2"
            onClick={() => setEditOpen(true)}
          >
            <GroupChatAvatar
              seeds={chat.bots.map((bot) => bot.avatar)}
              className="shrink-0"
            />
            <span className="truncate text-sm font-medium">{chat.name}</span>
          </Button>
          <GroupChatDialog
            bots={userBots}
            chat={chat}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </>
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
