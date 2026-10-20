import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatHeader } from "@/components/chat-header"
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

  return (
    <div className="flex min-h-svh flex-col">
      <ChatHeader chat={chat} />
      <p>{chatId}</p>
    </div>
  )
}
