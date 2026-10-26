import { asc, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { bots, chatMembers, chats } from "@/lib/db/schema"

// Chats belong to one Clerk user; always pass the userId from auth()
export async function getUserChats(userId: string) {
  const rows = await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.lastMessageAt)],
    with: {
      members: {
        orderBy: [asc(chatMembers.joinedAt)],
        with: { bot: true },
      },
    },
  })

  return rows.map((chat) => {
    const members = chat.members.map((member) => member.bot)

    return {
      id: chat.id,
      kind: chat.kind,
      name: chat.name ?? members[0]?.name ?? "Untitled chat",
      // Every member's face in join order: a group chat draws them all, a direct chat draws its one
      avatars: members.map((bot) => bot.avatar),
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageAt: chat.lastMessageAt,
    }
  })
}

export type UserChat = Awaited<ReturnType<typeof getUserChats>>[number]

// The bots a group chat can pick from; always pass the userId from auth()
export async function getUserBots(userId: string) {
  return db.query.bots.findMany({
    where: eq(bots.userId, userId),
    columns: { id: true, name: true, avatar: true },
    orderBy: [asc(bots.createdAt)],
  })
}

export type UserBot = Awaited<ReturnType<typeof getUserBots>>[number]
