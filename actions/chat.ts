"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

import { chatAgent } from "@/trigger/chat"
import { getUserChat } from "@/queries/chats"

const startSession = chat.createStartSessionAction<typeof chatAgent>("chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

// Every action takes a chatId from the browser, so check it belongs to the signed-in user
async function getOwnedChat(chatId: string) {
  const { userId } = await auth.protect()

  const userChat = await getUserChat(userId, chatId)
  if (!userChat) throw new Error("Chat not found")

  return userChat
}

export async function mintChatAccessToken(chatId: string) {
  await getOwnedChat(chatId)

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function startChatSession(
  params: Parameters<typeof startSession>[0]
) {
  await getOwnedChat(params.chatId)

  return startSession(params)
}

export async function loadChatTranscript(
  params: Parameters<typeof loadTranscript>[0]
) {
  await getOwnedChat(params.chatId)

  return loadTranscript(params)
}
