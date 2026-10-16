import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

// Next.js loads .env.local for the app, but drizzle-kit runs outside Next
config({ path: ".env.local" })

if (!process.env.DATABASE_URL_UNPOOLED) {
  throw new Error("DATABASE_URL_UNPOOLED is not set")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  // Push uses the direct connection; pooled connections can break DDL
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
})
