"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { bots, botFormSchema } from "@/lib/db/schema"

export async function createBot(input: unknown) {
  const { userId } = await auth.protect()

  const parsed = botFormSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const [bot] = await db
    .insert(bots)
    .values({
      ...parsed.data,
      userId,
      instructions: parsed.data.instructions || null,
    })
    .returning({ id: bots.id })

  revalidatePath("/")

  return { id: bot.id }
}
