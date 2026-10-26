"use client"

import { useChat } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react"
import {
  ArrowDownUpIcon,
  EyeIcon,
  FilePenIcon,
  FileTextIcon,
  FolderIcon,
  KeyboardIcon,
  MonitorIcon,
  MousePointerClickIcon,
  MousePointerIcon,
  TerminalIcon,
  TypeIcon,
} from "lucide-react"
import Image from "next/image"
import { useState, type ReactNode } from "react"

import {
  loadChatTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import type { chatAgent } from "@/trigger/chat"

type ChatMessage = InferChatUIMessage<typeof chatAgent>
type ChatPart = ChatMessage["parts"][number]
type ShowScreenPart = Extract<ChatPart, { type: "tool-show_screen" }>
type ToolPart = Exclude<
  Extract<ChatPart, { type: `tool-${string}` }>,
  ShowScreenPart
>

// Consecutive tool calls share one Trace; text and screenshots end the run
type PartBlock =
  | { kind: "text"; text: string; key: string }
  | { kind: "tools"; parts: ToolPart[]; key: string }
  | { kind: "screen"; part: ShowScreenPart; key: string }

function groupParts(parts: ChatPart[]): PartBlock[] {
  const blocks: PartBlock[] = []

  parts.forEach((part, index) => {
    const key = `${index}-${part.type}`

    if (part.type === "text") {
      blocks.push({ kind: "text", text: part.text, key })
    } else if (part.type === "tool-show_screen") {
      blocks.push({ kind: "screen", part, key })
    } else if (part.type.startsWith("tool-")) {
      const toolPart = part as ToolPart
      const last = blocks.at(-1)

      if (last?.kind === "tools") last.parts.push(toolPart)
      else blocks.push({ kind: "tools", parts: [toolPart], key })
    }
  })

  return blocks
}

type ChatBot = { id: string; name: string; avatar: string }

export function Chat({ chatId, bots }: { chatId: string; bots: ChatBot[] }) {
  // The bot that answers the next message. A direct chat has one; a group chat lets the person pick
  const [botId, setBotId] = useState(bots[0]?.id ?? "")

  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Sent with every message, so the picked bot answers that turn
    clientData: { botId },
  })

  const { messages, isLoading } = useLoadTranscript(
    chatId,
    loadChatTranscript,
    { transport }
  )

  if (isLoading) return null

  return (
    <ChatThread
      chatId={chatId}
      bots={bots}
      botId={botId}
      onBotChange={setBotId}
      initialMessages={messages as ChatMessage[]}
      transport={transport}
    />
  )
}

function ChatThread({
  chatId,
  bots,
  botId,
  onBotChange,
  initialMessages,
  transport,
}: {
  chatId: string
  bots: ChatBot[]
  botId: string
  onBotChange: (botId: string) => void
  initialMessages: ChatMessage[]
  transport: TriggerChatTransport
}) {
  const [input, setInput] = useState("")
  const { messages, sendMessage, status, stop } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
    resume: initialMessages.length > 0,
  })

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text.trim()) return

    sendMessage({ text: message.text })
    setInput("")
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
      <Conversation className="overflow-hidden">
        <ConversationContent scrollClassName="!overflow-x-hidden !overflow-y-auto">
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {groupParts(message.parts).map((block) => {
                    if (block.kind === "text") {
                      return (
                        <MessageResponse key={block.key}>
                          {block.text}
                        </MessageResponse>
                      )
                    }

                    if (block.kind === "screen") {
                      return (
                        <ShowScreen
                          key={block.key}
                          chatId={chatId}
                          part={block.part}
                        />
                      )
                    }

                    return (
                      <Trace key={block.key}>
                        {block.parts.map((part) => (
                          <ToolRow key={part.toolCallId} part={part} />
                        ))}
                      </Trace>
                    )
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything..."
            />
          </PromptInputBody>
          <PromptInputFooter>
            {bots.length > 1 && (
              <PromptInputTools>
                <PromptInputSelect
                  value={botId}
                  onValueChange={(value) => {
                    if (typeof value === "string") onBotChange(value)
                  }}
                >
                  <PromptInputSelectTrigger>
                    <PromptInputSelectValue>
                      {bots.find((bot) => bot.id === botId)?.name}
                    </PromptInputSelectValue>
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {bots.map((bot) => (
                      <PromptInputSelectItem key={bot.id} value={bot.id}>
                        {bot.name}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
            )}
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

// One line per tool call: what it did while running, what it did once it finished
function describeTool(part: ToolPart): {
  icon: ReactNode
  running: string
  done: string
} {
  switch (part.type) {
    case "tool-bash":
      return {
        icon: <TerminalIcon />,
        running: `Running ${part.input?.command ?? "a command"}`,
        done: `Ran ${part.input?.command ?? "a command"}`,
      }
    case "tool-read_file":
      return {
        icon: <FileTextIcon />,
        running: `Reading ${part.input?.path ?? "a file"}`,
        done: `Read ${part.input?.path ?? "a file"}`,
      }
    case "tool-write_file":
      return {
        icon: <FilePenIcon />,
        running: `Writing ${part.input?.path ?? "a file"}`,
        done: `Wrote ${part.input?.path ?? "a file"}`,
      }
    case "tool-list_files":
      return {
        icon: <FolderIcon />,
        running: `Listing ${part.input?.path ?? "a folder"}`,
        done: `Listed ${part.input?.path ?? "a folder"}`,
      }
    case "tool-mouse_move":
      return {
        icon: <MousePointerIcon />,
        running: "Moving the mouse",
        done: `Moved the mouse to ${part.input?.x}, ${part.input?.y}`,
      }
    case "tool-mouse_click":
      return {
        icon: <MousePointerClickIcon />,
        running: "Clicking",
        done: `Clicked ${part.input?.x}, ${part.input?.y}${part.input?.double ? " (double)" : ""}`,
      }
    case "tool-mouse_scroll":
      return {
        icon: <ArrowDownUpIcon />,
        running: "Scrolling",
        done: `Scrolled ${part.input?.direction}`,
      }
    case "tool-keyboard_type":
      return {
        icon: <TypeIcon />,
        running: "Typing",
        done: `Typed ${part.input?.text ?? "text"}`,
      }
    case "tool-keyboard_press":
      return {
        icon: <KeyboardIcon />,
        running: "Pressing a key",
        done: `Pressed ${[...(part.input?.modifiers ?? []), part.input?.key].join(" + ")}`,
      }
    case "tool-view_screen":
      return {
        icon: <EyeIcon />,
        running: "Looking at the screen",
        done: "Looked at the screen",
      }
  }
}

// The text shown when a row is opened: command output, file content, or the raw result
function resultDetail(part: ToolPart): string | undefined {
  if (part.state !== "output-available") return undefined

  const output: unknown = part.output
  if (typeof output === "object" && output !== null && "error" in output) {
    return String(output.error)
  }

  if (part.type === "tool-bash" && "output" in part.output) {
    return part.output.output
  }

  if (part.type === "tool-read_file" && "content" in part.output) {
    return part.output.content
  }

  return JSON.stringify(output, null, 2)
}

function ToolRow({ part }: { part: ToolPart }) {
  const { icon, running, done } = describeTool(part)

  const isRunning =
    part.state === "input-streaming" || part.state === "input-available"
  const failed =
    part.state === "output-error" ||
    (part.state === "output-available" &&
      typeof part.output === "object" &&
      part.output !== null &&
      "error" in part.output)
  const status = failed ? "error" : isRunning ? "running" : undefined

  const line = (
    <TraceLine status={status}>
      <TraceIcon>{icon}</TraceIcon>
      <TraceTitle>{isRunning ? running : done}</TraceTitle>
    </TraceLine>
  )

  const detail = resultDetail(part)
  if (detail === undefined) return line

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <CodeBlock size="sm" variant={failed ? "destructive" : "default"}>
          <CodeBlockContent wrap className="max-h-64">
            {detail}
          </CodeBlockContent>
        </CodeBlock>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

// Shown to the person; view_screen stays out of the chat
function ShowScreen({
  chatId,
  part,
}: {
  chatId: string
  part: ShowScreenPart
}) {
  if (part.state !== "output-available") {
    return (
      <Trace>
        <TraceLine status={part.state === "output-error" ? "error" : "running"}>
          <TraceIcon>
            <MonitorIcon />
          </TraceIcon>
          <TraceTitle>Taking a screenshot</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }

  if ("error" in part.output) {
    return (
      <Trace>
        <TraceLine status="error">
          <TraceIcon>
            <MonitorIcon />
          </TraceIcon>
          <TraceTitle>{part.output.error}</TraceTitle>
        </TraceLine>
      </Trace>
    )
  }

  const src = `/api/chats/${chatId}/screenshots?path=${encodeURIComponent(part.output.path)}`

  return (
    // Unoptimized: the optimizer fetches the URL server-side, where the Clerk session cookie isn't sent
    <Image
      src={src}
      alt="Screenshot of the bot's desktop"
      width={part.output.width ?? 1024}
      height={part.output.height ?? 768}
      unoptimized
      className="h-auto w-full max-w-2xl rounded-lg border"
    />
  )
}
