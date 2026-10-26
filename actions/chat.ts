"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { bots, chatMembers, chats, groupChatFormSchema } from "@/lib/db/schema"
import { chatAgent } from "@/trigger/chat"
import { getUserChat } from "@/queries/chats"

const startSession = chat.createStartSessionAction<typeof chatAgent>("chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

export async function createGroupChat(input: unknown) {
  const { userId } = await auth.protect()

  const parsed = groupChatFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Picking the same bot twice counts once
  const botIds = [...new Set(parsed.data.botIds)]

  // Only the signed-in user's own bots can join, whatever the form sent
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))

  if (botIds.length < 2 || owned.length !== botIds.length) {
    return { error: "Pick at least two of your bots" }
  }

  const groupChat = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name: parsed.data.name })
      .returning({ id: chats.id })

    await tx
      .insert(chatMembers)
      .values(botIds.map((botId) => ({ chatId: row.id, botId })))

    return row
  })

  // The sidebar lists chats, so refresh the layout that renders it
  revalidatePath("/", "layout")

  return { id: groupChat.id }
}

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
