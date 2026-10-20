import { auth } from "@clerk/nextjs/server"
import { neon } from "@neon/ai-sdk-provider"
import { convertToModelMessages, streamText, type UIMessage } from "ai"

export async function POST(req: Request) {
  await auth.protect()

  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: neon("claude-sonnet-5"),
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
