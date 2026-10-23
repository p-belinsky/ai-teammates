import { neon } from "@neon/ai-sdk-provider"
import { chat, type InferChatUIMessageFromTools } from "@trigger.dev/sdk/ai"
import { stepCountIs } from "ai"

import { getChatBot } from "../lib/chat-bot"
import { computerTools } from "../lib/computer-use"

// The chat UI reads tool parts through this type, so it stays in sync with the tool set
export type ComputerTools = ReturnType<typeof computerTools>
export type ChatUIMessage = InferChatUIMessageFromTools<ComputerTools>

// Looked up by chat id on every worker and every turn. clientData is not used: the browser
// sends none per message, so reading it here fails on the continuation turns.
async function loadBot(chatId: string) {
  const bot = await getChatBot(chatId)
  if (!bot) throw new Error(`No bot for chat ${chatId}`)

  return bot
}

function buildSystemPrompt(bot: {
  name: string
  job: string
  instructions: string | null
}) {
  return [
    `You are ${bot.name}. Your job is ${bot.job}.`,
    bot.instructions ? `How you go about it:\n${bot.instructions}` : null,
    "You are chatting one-on-one with the person you work for. Stay in character as this bot.",
    "You live in your own sandbox: an isolated Linux environment created for you alone. It has its own filesystem and network, and it is separate from the app and from every other bot's sandbox.",
    "You can work in that sandbox with bash, read_file, write_file and list_files. You also have a virtual desktop with a mouse and keyboard: mouse_move, mouse_click, mouse_scroll, keyboard_type and keyboard_press. Take view_screen before you click so you know where things are, and again afterwards to check the result. Mouse coordinates are pixels from the top-left corner of the screen.",
    "Use show_screen only when the person asks what is on the screen. It shows them the screenshot.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export const chatAgent = chat.withUIMessage<ChatUIMessage>().agent({
  id: "chat",
  // Resolved every turn, so each chat drives its own bot's sandbox
  tools: async ({ chatId }) => computerTools((await loadBot(chatId)).sandboxId),
  // Runs on every fresh worker, so the prompt survives restarts and continuations
  onBoot: async ({ chatId }) => {
    chat.prompt.set(buildSystemPrompt(await loadBot(chatId)))
  },
  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: neon("claude-sonnet-5"),
      messages,
      tools,
      abortSignal: signal,
      // Each tool call is a step, so the model needs room to act and then answer
      stopWhen: stepCountIs(25),
    }),
})
