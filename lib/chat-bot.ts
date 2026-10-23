import { asc, eq } from "drizzle-orm"

import { db } from "./db"
import { chatMembers } from "./db/schema"

// Read on the server by the agent, so the bot never comes from the browser.
// Group chats are not handled yet, so the chat uses its first bot, as getUserChat does.
export async function getChatBot(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: eq(chatMembers.chatId, chatId),
    orderBy: [asc(chatMembers.joinedAt)],
    with: { bot: true },
  })

  return member?.bot ?? null
}
