import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { Chat } from "@/components/chat"
import { ChatDesktop } from "@/components/chat-desktop"
import { ChatHeader } from "@/components/chat-header"
import { ChatLayout } from "@/components/chat-layout"
import { ChatVncProvider } from "@/components/chat-vnc"
import { getUserBots } from "@/queries/bots"
import { getUserChat } from "@/queries/chats"

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>
}) {
  const { userId } = await auth.protect()

  const { chatId } = await params
  const chat = await getUserChat(userId, chatId)

  if (!chat) notFound()

  const userBots = await getUserBots(userId)

  return (
    <ChatVncProvider key={chat.id} chatId={chat.id}>
      <ChatLayout
        panel={
          chat.bot && <ChatDesktop botName={chat.bot.name} />
        }
      >
        <ChatHeader chat={chat} userBots={userBots} />
        <Chat chatId={chat.id} bots={chat.bots} />
      </ChatLayout>
    </ChatVncProvider>
  )
}
