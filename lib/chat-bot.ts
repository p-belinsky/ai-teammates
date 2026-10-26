import { asc, eq } from "drizzle-orm"

import { db } from "./db"
import { chatMembers } from "./db/schema"

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
