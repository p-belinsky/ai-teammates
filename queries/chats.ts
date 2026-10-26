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
        with: { bot: true },
      },
    },
  })

  if (!chat) return null

  // Every member in the order they joined, so a group chat can offer all of them
  const bots = chat.members.map((member) => member.bot)

  return {
    id: chat.id,
    kind: chat.kind,
    name: chat.name ?? bots[0]?.name ?? "Untitled chat",
    bots,
    // Only a direct chat has one bot to edit and to show on the desktop panel
    bot: chat.kind === "direct" ? (bots[0] ?? null) : null,
  }
}
