import { and, asc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, chats } from "@/lib/db/schema"

// Scoped to one Clerk user; always pass the userId from auth()
export async function getUserChat(userId: string, chatId: string) {
  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
    with: {
      members: {
        orderBy: [asc(chatMembers.joinedAt)],
        limit: 1,
        with: { bot: true },
      },
    },
  })

  if (!chat) return null

  // Group chats are not handled yet, so the chat shows its first bot
  const bot = chat.members[0]?.bot ?? null

  return {
    id: chat.id,
    name: chat.name ?? bot?.name ?? "Untitled chat",
    bot,
  }
}
