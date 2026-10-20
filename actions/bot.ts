"use server"

import { auth } from "@clerk/nextjs/server"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { bots, botFormSchema, chatMembers, chats } from "@/lib/db/schema"

export async function createBot(input: unknown) {
  const { userId } = await auth.protect()

  const parsed = botFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // One transaction so the bot never exists without its direct chat
  const { bot, chat } = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({
        ...parsed.data,
        userId,
        instructions: parsed.data.instructions || null,
      })
      .returning({ id: bots.id })

    // Direct chats show the bot's name, so name stays null
    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "direct" })
      .returning({ id: chats.id })

    await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })

    return { bot, chat }
  })

  revalidatePath("/")

  return { id: bot.id, chatId: chat.id }
}

export async function updateBot(botId: string, input: unknown) {
  const { userId } = await auth.protect()

  const parsed = botFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Scoped to the signed-in user so one user can't edit another's bot
  const [bot] = await db
    .update(bots)
    .set({
      ...parsed.data,
      instructions: parsed.data.instructions || null,
    })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning({ id: bots.id })

  if (!bot) {
    return { error: "Bot not found" }
  }

  // The bot's name and face also show in the sidebar, so refresh the layout
  revalidatePath("/", "layout")

  return { id: bot.id }
}

export async function deleteBot(botId: string) {
  const { userId } = await auth.protect()

  // One transaction so no direct chat is left behind without its bot
  const deleted = await db.transaction(async (tx) => {
    // Read the direct chats first: deleting the bot cascades its memberships
    const directChats = await tx
      .select({ id: chats.id })
      .from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(
        and(
          eq(chatMembers.botId, botId),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )

    const [bot] = await tx
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning({ id: bots.id })

    if (!bot) return false

    // Direct chats have no name of their own, so they go with the bot
    if (directChats.length > 0) {
      await tx.delete(chats).where(
        inArray(
          chats.id,
          directChats.map((chat) => chat.id)
        )
      )
    }

    return true
  })

  if (!deleted) {
    return { error: "Bot not found" }
  }

  revalidatePath("/", "layout")

  return { id: botId }
}
