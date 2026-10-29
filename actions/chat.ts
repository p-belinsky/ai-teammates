"use server"

import { auth } from "@clerk/nextjs/server"
import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { canUseBots, UPGRADE_MESSAGE } from "@/lib/billing"
import { db } from "@/lib/db"
import { bots, chatMembers, chats, groupChatFormSchema } from "@/lib/db/schema"
import { chatAgent } from "@/trigger/chat"
import { getUserChat } from "@/queries/chats"

const startSession = chat.createStartSessionAction<typeof chatAgent>("chat")
const loadTranscript = chat.createLoadTranscriptAction(defaultStorage)

// Only the signed-in user's own bots can join, whatever the form sent
async function hasOnlyOwnedBots(userId: string, botIds: string[]) {
  const owned = await db
    .select({ id: bots.id })
    .from(bots)
    .where(and(eq(bots.userId, userId), inArray(bots.id, botIds)))

  return owned.length === botIds.length
}

export async function createGroupChat(input: unknown) {
  const { userId } = await auth.protect()

  const parsed = groupChatFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Picking the same bot twice counts once
  const botIds = [...new Set(parsed.data.botIds)]

  if (botIds.length < 2 || !(await hasOnlyOwnedBots(userId, botIds))) {
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

export async function updateGroupChat(chatId: string, input: unknown) {
  const { userId } = await auth.protect()

  const parsed = groupChatFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const botIds = [...new Set(parsed.data.botIds)]

  if (botIds.length < 2 || !(await hasOnlyOwnedBots(userId, botIds))) {
    return { error: "Pick at least two of your bots" }
  }

  // Scoped to the signed-in user's group chats, so direct chats can't change members
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(chats)
      .set({ name: parsed.data.name })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "group")
        )
      )
      .returning({ id: chats.id })

    if (!row) return false

    // Swap the members for the picked bots in one transaction, so the chat is never left empty
    await tx.delete(chatMembers).where(eq(chatMembers.chatId, chatId))
    await tx
      .insert(chatMembers)
      .values(botIds.map((botId) => ({ chatId, botId })))

    return true
  })

  if (!updated) {
    return { error: "Group chat not found" }
  }

  // The sidebar and the chat header both show the name and members, so refresh the layout
  revalidatePath("/", "layout")

  return { id: chatId }
}

export async function deleteGroupChat(chatId: string) {
  const { userId } = await auth.protect()

  // Its members go with it: chat_members cascades from the chat. The bots themselves stay.
  const [deleted] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })

  if (!deleted) {
    return { error: "Group chat not found" }
  }

  revalidatePath("/", "layout")

  return { id: deleted.id }
}

// Every action takes a chatId from the browser, so check it belongs to the signed-in user
async function getOwnedChat(chatId: string) {
  const { userId } = await auth.protect()

  const userChat = await getUserChat(userId, chatId)
  if (!userChat) throw new Error("Chat not found")

  return userChat
}

// Talking to a bot runs its sandbox, so a free account can't open a bot session
async function getBotChat(chatId: string) {
  const { has } = await auth.protect()
  if (!canUseBots(has)) throw new Error(UPGRADE_MESSAGE)

  return getOwnedChat(chatId)
}

export async function mintChatAccessToken(chatId: string) {
  await getBotChat(chatId)

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

export async function startChatSession(
  params: Parameters<typeof startSession>[0]
) {
  await getBotChat(params.chatId)

  return startSession(params)
}

export async function loadChatTranscript(
  params: Parameters<typeof loadTranscript>[0]
) {
  await getOwnedChat(params.chatId)

  return loadTranscript(params)
}
