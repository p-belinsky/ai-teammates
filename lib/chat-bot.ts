import { asc, eq } from "drizzle-orm"

import { db } from "./db"
import { chatMembers, chats } from "./db/schema"

// The person a chat belongs to. Their plan and budget cover every turn in it.
export async function getChatOwner(chatId: string) {
  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
  if (!chat) throw new Error("Chat not found")

  return chat.userId
}

// Read on the server by the agent, in join order. The browser names the bot for each turn,
// so the agent checks that bot against this list rather than trusting it.
export async function getChatMembers(chatId: string) {
  const members = await db.query.chatMembers.findMany({
    where: eq(chatMembers.chatId, chatId),
    orderBy: [asc(chatMembers.joinedAt)],
    with: { bot: true },
  })

  return members.map((member) => member.bot)
}
