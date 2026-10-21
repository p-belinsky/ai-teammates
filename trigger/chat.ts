import { neon } from "@neon/ai-sdk-provider"
import { chat } from "@trigger.dev/sdk/ai"

export const chatAgent = chat.agent({
  id: "chat",
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: neon("claude-sonnet-5"),
      messages,
      abortSignal: signal,
    }),
})
