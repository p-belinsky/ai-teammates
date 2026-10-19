"use server"

import { auth } from "@clerk/nextjs/server"
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
