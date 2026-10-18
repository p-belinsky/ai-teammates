import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { nanoid } from "nanoid"

export const bots = pgTable(
  "bots",
  {
    id: text().primaryKey().$defaultFn(() => nanoid()),
    // Third-party user id (Clerk)
    userId: text().notNull(),
    name: text().notNull(),
    // Seed for the bot's face
    avatar: text().notNull().$defaultFn(() => nanoid()),
    // What the bot is for, in a phrase
    job: text().notNull(),
    // How the bot should go about the job
    instructions: text(),
    // Third-party sandbox id, created lazily
    sandboxId: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)]
)
