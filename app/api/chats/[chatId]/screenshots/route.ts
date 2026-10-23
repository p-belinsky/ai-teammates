import { auth } from "@clerk/nextjs/server"

import { readySandbox, SCREENSHOT_PATTERN } from "@/lib/computer-use"
import { getUserChat } from "@/queries/chats"

// Serves one screenshot from the chat's bot sandbox, for the chat to show inline
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { userId } = await auth.protect()

  const { chatId } = await params
  const userChat = await getUserChat(userId, chatId)
  if (!userChat?.bot) return new Response("Not found", { status: 404 })

  // Only screenshot files the tools write, so the path can't reach anything else in the sandbox
  const path = new URL(request.url).searchParams.get("path") ?? ""
  if (!SCREENSHOT_PATTERN.test(path)) {
    return new Response("Not found", { status: 404 })
  }

  try {
    // The sandbox auto-stops when idle, and a stopped one can't serve files, so start it as the tools do
    const sandbox = await readySandbox(userChat.bot.sandboxId)
    const bytes = await sandbox.fs.downloadFile(path)

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Screenshot download failed", { path, error })
    return new Response("Couldn't load the screenshot", { status: 500 })
  }
}
