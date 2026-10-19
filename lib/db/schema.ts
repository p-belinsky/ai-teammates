import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
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
    // Third-party sandbox id, created lazily
    sandboxId: text(),
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
