import { and, eq } from "drizzle-orm"

import { db } from "./db"
import { chatMembers } from "./db/schema"

// Read on the server by the agent, so the bot never comes from the browser unchecked.
// The browser names the bot for each turn, so it must be a member of this chat.
export async function getChatBot(chatId: string, botId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.botId, botId)),
    with: { bot: true },
  })

  return member?.bot ?? null
}
