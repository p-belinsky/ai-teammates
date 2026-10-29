import { auth } from "@clerk/nextjs/server"

import { canUseSandboxes, UPGRADE_MESSAGE } from "@/lib/billing"
import { desktopUrl } from "@/lib/computer-use"
import { getUserChat } from "@/queries/chats"

// Returns the chat bot's desktop URL for the VNC viewer; the viewer loads it once
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { userId, has } = await auth.protect()

  const { chatId } = await params
  const userChat = await getUserChat(userId, chatId)
  if (!userChat?.bot) return new Response("Not found", { status: 404 })

  if (!canUseSandboxes(has)) {
    return new Response(UPGRADE_MESSAGE, { status: 403 })
  }

  try {
    const url = await desktopUrl(userChat.bot.sandboxId)

    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Desktop URL failed", { chatId, error })
    return new Response("Couldn't connect to the desktop", { status: 500 })
  }
}
