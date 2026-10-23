import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { posix } from "node:path"
import { z } from "zod"

import { daytona } from "./daytona"

// Screenshots live in the bot's sandbox so the chat transcript only stores a path, not the image
export const SCREENSHOT_DIR = "/home/daytona/screenshots"
export const SCREENSHOT_PATTERN = new RegExp(
  `^${SCREENSHOT_DIR}/[0-9a-f-]{36}\\.jpg$`
)

// Keeps tool results small enough for the model's context and the chat stream's per-record cap
const MAX_OUTPUT_CHARS = 20_000
const MAX_READ_BYTES = 200_000
const MAX_LIST_ENTRIES = 200

type ScreenshotResult = {
  path: string
  width: number | null
  height: number | null
}

// Errors go back to the model as data so it can recover, instead of failing the turn
async function attempt<T>(
  run: () => Promise<T>
): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    }
  }
}

function truncate(text: string) {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

// Writes through the shell instead of fs.uploadFile, which needs form-data and fails in the Trigger.dev bundle.
// Each chunk is decoded on its own, so the chunk size must stay a multiple of 4 characters.
const WRITE_CHUNK_CHARS = 64 * 1024

async function writeBase64(sandbox: Sandbox, path: string, encoded: string) {
  const target = shellQuote(path)
  await sandbox.process.executeCommand(`: > ${target}`)

  for (let start = 0; start < encoded.length; start += WRITE_CHUNK_CHARS) {
    const chunk = encoded.slice(start, start + WRITE_CHUNK_CHARS)
    const response = await sandbox.process.executeCommand(
      `printf '%s' '${chunk}' | base64 -d >> ${target}`
    )
    if (response.exitCode !== 0) {
      throw new Error(`Writing ${path} failed: ${response.result}`)
    }
  }
}

export async function readySandbox(sandboxId: string) {
  const sandbox = await daytona.get(sandboxId)
  if (sandbox.state !== "started") await sandbox.start()

  return sandbox
}

async function readyDesktop(sandbox: Sandbox) {
  const { status } = await sandbox.computerUse.getStatus()
  if (status !== "running") await sandbox.computerUse.start()
}

async function captureScreen(sandbox: Sandbox): Promise<ScreenshotResult> {
  await readyDesktop(sandbox)

  const { displays = [] } = await sandbox.computerUse.display.getInfo()
  const display = displays.find((item) => item.isActive) ?? displays[0]

  const shot = await sandbox.computerUse.screenshot.takeCompressed({
    format: "jpeg",
    quality: 70,
    showCursor: true,
  })

  const path = `${SCREENSHOT_DIR}/${crypto.randomUUID()}.jpg`
  await sandbox.process.executeCommand(`mkdir -p ${SCREENSHOT_DIR}`)
  await writeBase64(sandbox, path, shot.screenshot ?? "")

  return {
    path,
    width: display?.width ?? null,
    height: display?.height ?? null,
  }
}

// noVNC serves the desktop on this port in the default sandbox image
const DESKTOP_PORT = 6080
const DESKTOP_URL_TTL_SECONDS = 3600

// Signed URL so the desktop can be embedded in an iframe, which can't send the preview token header
export async function desktopUrl(sandboxId: string) {
  const sandbox = await readySandbox(sandboxId)
  await readyDesktop(sandbox)

  const preview = await sandbox.getSignedPreviewUrl(
    DESKTOP_PORT,
    DESKTOP_URL_TTL_SECONDS
  )
  const url = new URL("/vnc.html", preview.url)
  url.search = "autoconnect=true&resize=scale&reconnect=true"

  return url.toString()
}

// The model sees the picture for the turn; the transcript keeps only the path
async function screenshotForModel(
  sandboxId: string,
  output: ScreenshotResult | { error: string },
  note: string
) {
  if ("error" in output)
    return { type: "error-text" as const, value: output.error }

  const sandbox = await readySandbox(sandboxId)
  const bytes = await sandbox.fs.downloadFile(output.path)

  return {
    type: "content" as const,
    value: [
      {
        type: "text" as const,
        text: `${note} The screen is ${output.width}x${output.height} pixels.`,
      },
      {
        type: "file" as const,
        mediaType: "image/jpeg",
        data: { type: "data" as const, data: bytes.toString("base64") },
      },
    ],
  }
}

// Every tool runs against the bot's own sandbox, so the tools are built per bot
export function computerTools(sandboxId: string) {
  return {
    bash: tool({
      description:
        "Run a shell command in your sandbox. Returns the exit code and the output. Working directory is /home/daytona.",
      inputSchema: z.object({
        command: z.string().min(1),
        timeoutSeconds: z.number().int().min(1).max(600).default(60),
      }),
      execute: ({ command, timeoutSeconds }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          const response = await sandbox.process.executeCommand(
            command,
            undefined,
            undefined,
            timeoutSeconds
          )

          return {
            exitCode: response.exitCode,
            output: truncate(response.result),
          }
        }),
    }),

    read_file: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: ({ path }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          const bytes = await sandbox.fs.downloadFile(path)

          if (bytes.length > MAX_READ_BYTES) {
            throw new Error(
              `The file is ${bytes.length} bytes, over the ${MAX_READ_BYTES} byte limit. Use bash with head or tail instead.`
            )
          }

          return { path, content: bytes.toString("utf8") }
        }),
    }),

    write_file: tool({
      description:
        "Write a text file in your sandbox, creating it and any missing folders. Replaces the file if it exists.",
      inputSchema: z.object({
        path: z.string().min(1),
        content: z.string(),
      }),
      execute: ({ path, content }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)

          await sandbox.process.executeCommand(
            `mkdir -p ${shellQuote(posix.dirname(path))}`
          )
          await writeBase64(
            sandbox,
            path,
            Buffer.from(content, "utf8").toString("base64")
          )

          return { path, bytes: Buffer.byteLength(content, "utf8") }
        }),
    }),

    list_files: tool({
      description: "List the files and folders in a directory in your sandbox.",
      inputSchema: z.object({ path: z.string().min(1) }),
      execute: ({ path }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          const files = await sandbox.fs.listFiles(path)

          return {
            path,
            entries: files.slice(0, MAX_LIST_ENTRIES).map((file) => ({
              name: file.name,
              type: file.isDir ? ("directory" as const) : ("file" as const),
              size: file.size,
            })),
          }
        }),
    }),

    mouse_move: tool({
      description:
        "Move the mouse pointer to a point on the desktop, in pixels from the top-left corner of the screen.",
      inputSchema: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
      }),
      execute: ({ x, y }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          await readyDesktop(sandbox)
          const position = await sandbox.computerUse.mouse.move(x, y)

          return { x: position.x, y: position.y }
        }),
    }),

    mouse_click: tool({
      description:
        "Click on the desktop at a point, in pixels from the top-left corner of the screen. Take a view_screen first so you know where things are.",
      inputSchema: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false),
      }),
      execute: ({ x, y, button, double }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          await readyDesktop(sandbox)
          await sandbox.computerUse.mouse.click(x, y, button, double)

          return { x, y, button, double }
        }),
    }),

    mouse_scroll: tool({
      description:
        "Scroll the mouse wheel at a point on the desktop, in pixels from the top-left corner of the screen.",
      inputSchema: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        direction: z.enum(["up", "down"]),
        amount: z.number().int().min(1).max(20).default(3),
      }),
      execute: ({ x, y, direction, amount }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          await readyDesktop(sandbox)
          await sandbox.computerUse.mouse.scroll(x, y, direction, amount)

          return { x, y, direction, amount }
        }),
    }),

    keyboard_type: tool({
      description: "Type text on the desktop into the focused window.",
      inputSchema: z.object({ text: z.string().min(1) }),
      execute: ({ text }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          await readyDesktop(sandbox)
          await sandbox.computerUse.keyboard.type(text)

          return { typed: text }
        }),
    }),

    keyboard_press: tool({
      description:
        "Press a key on the desktop, optionally with modifiers. Examples: key 'enter', or key 'c' with modifiers ['ctrl'].",
      inputSchema: z.object({
        key: z.string().min(1),
        modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd"])).default([]),
      }),
      execute: ({ key, modifiers }) =>
        attempt(async () => {
          const sandbox = await readySandbox(sandboxId)
          await readyDesktop(sandbox)
          await sandbox.computerUse.keyboard.press(key, modifiers)

          return { key, modifiers }
        }),
    }),

    view_screen: tool({
      description:
        "Take a screenshot of your desktop so you can see it. Only you see the image; the person does not. Use it before and after mouse or keyboard actions.",
      inputSchema: z.object({}),
      execute: () =>
        attempt(async () => captureScreen(await readySandbox(sandboxId))),
      toModelOutput: ({ output }) =>
        screenshotForModel(sandboxId, output, "This is your screen now."),
    }),

    show_screen: tool({
      description:
        "Take a screenshot of your desktop and show it to the person in the chat. Use it only when they ask what is on the screen.",
      inputSchema: z.object({}),
      execute: () =>
        attempt(async () => captureScreen(await readySandbox(sandboxId))),
      toModelOutput: ({ output }) =>
        screenshotForModel(
          sandboxId,
          output,
          "You showed this screen to the person."
        ),
    }),
  }
}
