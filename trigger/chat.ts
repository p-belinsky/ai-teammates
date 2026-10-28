import { neon } from "@neon/ai-sdk-provider"
import { chat } from "@trigger.dev/sdk/ai"
import { stepCountIs, tool, type InferUITools, type UIMessage } from "ai"
import { z } from "zod"

import { MEMORY_PATH, memoryTools, readMemory } from "../lib/bot-memory"
import { getChatMembers } from "../lib/chat-bot"
import { computerTools } from "../lib/computer-use"
import type { bots } from "../lib/db/schema"

type Bot = typeof bots.$inferSelect

// The chat UI reads tool parts through these types, so they stay in sync with the tool set
export type ComputerTools = ReturnType<typeof computerTools>

// Lets the bot that is answering pass the conversation to another bot in the chat.
// Built per turn with the names it may hand to, so a name outside the chat is rejected.
function handoffTool(names: string[]) {
  return tool({
    description:
      "Hand the conversation to another bot in this group chat, by its exact name, when its job fits the person's message better than yours.",
    inputSchema: z.object({
      to: z.string().describe("The exact name of the bot to hand off to"),
      reason: z
        .string()
        .describe("A short reason, for the bot that takes over"),
    }),
    execute: async ({ to, reason }) => {
      if (!names.includes(to)) {
        return {
          error: `No bot named ${to} in this chat. Use one of: ${names.join(", ")}`,
        }
      }

      return { handedOff: true, to, reason }
    },
  })
}

export type ChatTools = ComputerTools &
  ReturnType<typeof memoryTools> & {
    handoff: ReturnType<typeof handoffTool>
  }
// The bot a person sent a message to, so a group chat can name it on that message
export type ChatUIMessage = UIMessage<
  { botId: string },
  { bot: { botId: string } },
  InferUITools<ChatTools>
>

const handoffOutput = z.object({
  handedOff: z.literal(true),
  to: z.string(),
  reason: z.string(),
})

// The handoff that went through in these steps, if any
function findHandoff(
  steps: { toolResults: { toolName: string; output: unknown }[] }[]
) {
  for (const step of steps) {
    for (const result of step.toolResults) {
      if (result.toolName !== "handoff") continue

      const parsed = handoffOutput.safeParse(result.output)
      if (parsed.success) return parsed.data
    }
  }
}

// Looked up on every turn, so each turn runs as the bot that was picked for it
async function loadTurn(chatId: string, botId: string | undefined) {
  const members = await getChatMembers(chatId)
  const bot = members.find((member) => member.id === botId)
  if (!bot) throw new Error(`Bot ${botId} isn't in chat ${chatId}`)

  return { bot, members }
}

function buildSystemPrompt({
  bot,
  members,
  memory,
  handoff,
}: {
  bot: Bot
  members: Bot[]
  memory: string
  handoff?: { from: string; reason: string }
}) {
  const others = members.filter((member) => member.id !== bot.id)
  const inGroup = others.length > 0

  return [
    `You are ${bot.name}. Your job is ${bot.job}.`,
    bot.instructions ? `How you go about it:\n${bot.instructions}` : null,
    inGroup
      ? [
          "You are in a group chat with the person you work for and the other bots listed below. The person picks which bot answers each message, and for this message that is you. Stay in character as yourself.",
          `The other bots in this chat:\n${others.map((other) => `- ${other.name}: ${other.job}`).join("\n")}`,
          "Replies from the other bots appear in this conversation too, as assistant messages. They aren't yours: don't speak for those bots, repeat them, or continue them.",
        ].join("\n\n")
      : "You are chatting one-on-one with the person you work for. Stay in character as this bot.",
    "You live in your own sandbox: an isolated Linux environment created for you alone. It has its own filesystem and network, and it is separate from the app and from every other bot's sandbox.",
    "You can work in that sandbox with bash, read_file, write_file and list_files. You also have a virtual desktop with a mouse and keyboard: mouse_move, mouse_click, mouse_scroll, keyboard_type and keyboard_press. Take view_screen before you click so you know where things are, and again afterwards to check the result. Mouse coordinates are pixels from the top-left corner of the screen.",
    "Use show_screen only when the person asks what is on the screen. It shows them the screenshot.",
    `Your memory is the list of notes below. It was loaded at the start of this turn and covers every chat with you, so use it to answer about things the person told you before, even in another chat. When the person tells you something worth keeping, such as their name, preferences, plans or facts about their work, save it with remember. Don't save a note that is already listed. To correct or remove a note, read ${MEMORY_PATH} and rewrite it with write_file.`,
    memory.trim()
      ? `What you remember:\n${memory.trim()}`
      : "You have no saved notes yet.",
    inGroup
      ? "Use handoff to pass the conversation to another bot in this chat, named exactly as listed above. Use it only when that bot's job clearly fits the person's message better than yours. Before you call it, say in one sentence who you are passing it to, and give a short reason. Your reply ends once the handoff goes through, and that bot answers from there. Otherwise answer yourself, even when the topic is outside your job."
      : null,
    handoff
      ? `${handoff.from} handed this conversation to you: ${handoff.reason} Answer the person directly, and don't mention the handoff itself.`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")
}

export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  .withClientData({ schema: z.object({ botId: z.string().min(1) }) })
  .agent({
    id: "chat",
    // Resolved every turn, so each turn drives the sandbox of the bot that answers it
    tools: async ({ chatId, clientData }) => {
      const { bot, members } = await loadTurn(chatId, clientData?.botId)
      const names = members
        .filter((member) => member.id !== bot.id)
        .map((member) => member.name)

      return {
        ...computerTools(bot.sandboxId),
        ...memoryTools(bot.sandboxId),
        handoff: handoffTool(names),
      }
    },
    // Every turn can be a different bot, so the prompt is set per turn rather than once per worker
    onTurnStart: async ({ chatId, clientData, writer }) => {
      const { bot, members } = await loadTurn(chatId, clientData?.botId)

      // Persisted with the reply, so the UI can show which bot wrote it
      writer.write({ type: "data-bot", data: { botId: bot.id } })
      chat.prompt.set(
        buildSystemPrompt({
          bot,
          members,
          memory: await readMemory(bot.sandboxId),
        })
      )
    },
    run: async ({
      chatId,
      clientData,
      messages,
      tools,
      signal,
      streamText,
    }) => {
      const first = streamText({
        model: neon("claude-sonnet-5"),
        messages,
        tools,
        abortSignal: signal,
        // A handoff that went through ends this bot's turn, so the bot it names takes over
        stopWhen: [
          stepCountIs(25),
          ({ steps }) => findHandoff(steps) !== undefined,
        ],
      })
      // pipeAndCapture, not pipe: only a captured turn saves the reply text to the transcript
      const { message: firstReply } = await chat.pipeAndCapture(first, {
        signal,
      })

      const handoff = findHandoff(await first.steps)
      if (!handoff) return

      const { bot: from, members } = await loadTurn(chatId, clientData?.botId)
      const target = members.find((member) => member.name === handoff.to)
      if (!target) return

      chat.response.write({ type: "data-bot", data: { botId: target.id } })
      chat.prompt.set(
        buildSystemPrompt({
          bot: target,
          members,
          memory: await readMemory(target.sandboxId),
          handoff: { from: from.name, reason: handoff.reason },
        })
      )

      // The new bot continues from the first bot's reply, and gets no handoff tool of its own
      const second = streamText({
        model: neon("claude-sonnet-5"),
        messages: [...messages, ...(await first.response).messages],
        tools: {
          ...computerTools(target.sandboxId),
          ...memoryTools(target.sandboxId),
        },
        abortSignal: signal,
        stopWhen: stepCountIs(25),
      })
      // Same id as the first bot's reply, so the handoff stays one message. Parts are left out:
      // the capture already holds them, and seeding them too would save them twice.
      await chat.pipeAndCapture(second, {
        signal,
        originalMessages: firstReply
          ? [{ ...firstReply, parts: [] }]
          : undefined,
      })
    },
  })
