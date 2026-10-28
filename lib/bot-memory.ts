import { tool } from "ai"
import { z } from "zod"

import { attempt, readySandbox, shellQuote } from "./computer-use"

// Lives in the bot's sandbox, so every chat with that bot reads and writes the same file
export const MEMORY_PATH = "/home/daytona/MEMORY.md"

// Keeps the notes small enough to load into every turn's prompt
const MAX_MEMORY_CHARS = 8_000
const MAX_NOTE_CHARS = 500

type Sandbox = Awaited<ReturnType<typeof readySandbox>>

// Bots made before the file existed have none, so a missing file reads as empty
async function readText(sandbox: Sandbox) {
  const response = await sandbox.process.executeCommand(`cat ${MEMORY_PATH}`)
  return response.exitCode === 0 ? response.result : ""
}

// Loaded into the system prompt on every turn, so the bot knows its notes without a tool call
export async function readMemory(sandboxId: string) {
  return readText(await readySandbox(sandboxId))
}

// Every tool runs against the bot's own sandbox, so the tools are built per bot
export function memoryTools(sandboxId: string) {
  return {
    remember: tool({
      description:
        "Save a short note to your memory. Every chat with you shares it, so the note is there in all of them. Use it for new facts the person tells you that are worth keeping later, such as their name, preferences, plans or facts about their work. Don't save a note that is already in your memory.",
      inputSchema: z.object({
        note: z.string().trim().min(1).max(MAX_NOTE_CHARS),
      }),
      execute: ({ note }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          const line = `- ${note.replace(/\s+/g, " ")}`
          const current = await readText(sandbox)

          if (current.length + line.length + 1 > MAX_MEMORY_CHARS) {
            throw new Error(
              `Your memory is full (${current.length} of ${MAX_MEMORY_CHARS} characters). Use write_file to shorten it, then save the note again.`
            )
          }

          // Appends rather than rewriting, so the notes already there can't be lost
          const response = await sandbox.process.executeCommand(
            `printf '%s\\n' ${shellQuote(line)} >> ${MEMORY_PATH}`
          )
          if (response.exitCode !== 0) {
            throw new Error(`Saving the note failed: ${response.result}`)
          }

          return { saved: note }
        }),
    }),
  }
}
