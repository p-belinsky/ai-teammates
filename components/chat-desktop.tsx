"use client"

import * as React from "react"
import { RotateCwIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { VncSlot, useChatVnc } from "@/components/chat-vnc"

type ChatDesktopProps = {
  botName: string
}

function ChatDesktop({ botName }: ChatDesktopProps) {
  const { reconnect } = useChatVnc()
  const [fullscreen, setFullscreen] = React.useState(false)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-end border-b px-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reconnect desktop"
          onClick={reconnect}
        >
          <RotateCwIcon />
        </Button>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Card>
          <CardContent className="p-0">
            <VncSlot name="panel" className="aspect-video overflow-hidden">
              <button
                type="button"
                aria-label="Open desktop fullscreen"
                className="absolute inset-0 z-10 cursor-zoom-in"
                onClick={() => setFullscreen(true)}
              />
            </VncSlot>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          {botName}&apos;s screen
        </p>
      </div>
      <Dialog
        open={fullscreen}
        modal={false}
        disablePointerDismissal
        onOpenChange={(open, details) => {
          // Only the close button closes it; hotkeys, outside clicks and focus loss are cancelled
          if (open) {
            setFullscreen(true)
          } else if (details.reason === "close-press") {
            setFullscreen(false)
          } else {
            details.cancel()
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none p-0 sm:max-w-none"
        >
          <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
            <DialogTitle className="text-sm font-medium">
              {botName}&apos;s screen
            </DialogTitle>
            <DialogClose
              render={
                <Button variant="ghost" size="icon" aria-label="Close desktop" />
              }
            >
              <XIcon />
            </DialogClose>
          </header>
          <VncSlot name="dialog" />
        </DialogContent>
      </Dialog>
    </>
  )
}

export { ChatDesktop }
