import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { createInsertSchema } from "drizzle-zod"
import { nanoid } from "nanoid"

export const bots = pgTable(
  "bots",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party user id (Clerk)
    userId: text().notNull(),
    name: text().notNull(),
    // Seed for the bot's face
    avatar: text()
      .notNull()
      .$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text().notNull(),
    // How the bot should go about the job
    instructions: text(),
    // Third-party sandbox id, created with the bot and deleted with it
    sandboxId: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)

export const insertBotSchema = createInsertSchema(bots, {
  name: (schema) => schema.trim().min(1, "Give your bot a name").max(40),
  job: (schema) => schema.trim().min(1, "Describe the bot's job").max(80),
  instructions: (schema) => schema.trim().max(500),
}).omit({ id: true, userId: true, sandboxId: true, createdAt: true })

// The fields the user fills in; the face seed is picked in the form too
export const botFormSchema = insertBotSchema
  .pick({ avatar: true, name: true, job: true, instructions: true })
  .required({ avatar: true })

export const chatKindEnum = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party user id (Clerk)
    userId: text().notNull(),
    kind: chatKindEnum().notNull().default("direct"),
    // Null for direct chats, which show the bot's name instead
    name: text(),
    lastMessagePreview: text(),
    lastMessageAt: timestamp().notNull().defaultNow(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)]
)

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text()
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text()
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ]
)

export const insertChatSchema = createInsertSchema(chats, {
  name: (schema) => schema.trim().min(1, "Name your group chat").max(40),
}).omit({
  id: true,
  userId: true,
  kind: true,
  lastMessagePreview: true,
  lastMessageAt: true,
  createdAt: true,
})

export const insertChatMemberSchema = createInsertSchema(chatMembers).omit({
  chatId: true,
  joinedAt: true,
})

// Name is nullable for direct chats, but a group chat always has one. Its bots must be at least two.
export const groupChatFormSchema = insertChatSchema
  .pick({ name: true })
  .required({ name: true })
  .extend({
    botIds: insertChatMemberSchema.shape.botId
      .array()
      .min(2, "Pick at least two bots"),
  })
  .refine((values) => values.name !== null, {
    path: ["name"],
    message: "Name your group chat",
  })

export const usageMeterEnum = pgEnum("usage_meter", [
  "ai_tokens",
  "sandbox_seconds",
])

// Append-only record of every charge. Micro-dollars for ai_tokens, seconds for sandbox_seconds.
export const usageEvents = pgTable(
  "usage_events",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Third-party user id (Clerk)
    userId: text().notNull(),
    meter: usageMeterEnum().notNull(),
    amount: integer().notNull(),
    // The billing period the charge falls in, from the Clerk subscription
    periodStart: timestamp().notNull(),
    // Unique per charge, so a retried turn or step can't be recorded twice
    reference: text().notNull().unique(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index("usage_events_user_period_idx").on(table.userId, table.periodStart),
  ]
)

// Running total per user, meter and period. Changed in the same transaction as its event.
export const usageBalances = pgTable(
  "usage_balances",
  {
    userId: text().notNull(),
    meter: usageMeterEnum().notNull(),
    periodStart: timestamp().notNull(),
    used: integer().notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.meter, table.periodStart] }),
  ]
)

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}))
