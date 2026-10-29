"use server"

import { auth } from "@clerk/nextjs/server"
import { DaytonaNotFoundError } from "@daytona/sdk"
import { and, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { MEMORY_PATH } from "@/lib/bot-memory"
import { daytona } from "@/lib/daytona"
import { db } from "@/lib/db"
import { bots, botFormSchema, chatMembers, chats } from "@/lib/db/schema"
import { canUseBots, UPGRADE_MESSAGE } from "@/lib/billing"

export async function createBot(input: unknown) {
  const { userId, has } = await auth.protect()

  // Creating a bot also creates its sandbox, so it needs a paid plan
  if (!canUseBots(has)) {
    return { error: UPGRADE_MESSAGE }
  }

  const parsed = botFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // The sandbox comes first so the bot row can store its id
  const sandbox = await daytona.create().catch(() => null)
  if (!sandbox) {
    return { error: "Couldn't create the bot's sandbox. Try again." }
  }

  try {
    // Every bot starts with a blank memory file, so it can keep notes across its chats
    await sandbox.process.executeCommand(`touch ${MEMORY_PATH}`)

    // One transaction so the bot never exists without its direct chat
    const { bot, chat } = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...parsed.data,
          userId,
          sandboxId: sandbox.id,
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
  } catch (error) {
    // No bot row points at this sandbox, so don't leave it behind
    await sandbox.delete().catch(() => {})
    throw error
  }
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

async function deleteSandbox(sandboxId: string) {
  try {
    const sandbox = await daytona.get(sandboxId)
    await sandbox.delete()
  } catch (error) {
    // Already gone, so there's nothing left to delete
    if (error instanceof DaytonaNotFoundError) return
    throw error
  }
}

export async function deleteBot(botId: string) {
  const { userId } = await auth.protect()

  // Read the sandbox id before the bot row is gone
  const [target] = await db
    .select({ sandboxId: bots.sandboxId })
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))

  if (!target) {
    return { error: "Bot not found" }
  }

  // Delete the sandbox first: if that fails, the bot stays so the user can retry
  try {
    await deleteSandbox(target.sandboxId)
  } catch {
    return { error: "Couldn't delete the bot's sandbox. Try again." }
  }

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
