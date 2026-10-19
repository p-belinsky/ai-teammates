import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { chatMembers, chats } from "@/lib/db/schema"

// Chats belong to one Clerk user; always pass the userId from auth()
export async function getUserChats(userId: string) {
  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt)],
    with: {
      members: {
        orderBy: [asc(chatMembers.joinedAt)],
        limit: 1,
        with: { bot: true },
      },
    },
  })

  return rows.map((chat) => {
    // Group chats are not handled yet, so every chat shows its first bot
    const bot = chat.members[0]?.bot ?? null

    return {
      id: chat.id,
      name: chat.name ?? bot?.name ?? "Untitled chat",
      avatar: bot?.avatar ?? null,
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
    }
  })
}

export type UserChat = Awaited<ReturnType<typeof getUserChats>>[number]
