"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { UserChat } from "@/queries/bots"

const userButtonAppearance = {
  elements: {
    rootBox: "w-full",
    userButtonTrigger:
      "flex h-8 w-full! cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 after:absolute after:inset-0 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
    userButtonBox: "flex w-full! flex-row items-center gap-2",
    userButtonAvatarBox: "order-first size-[1.5rem] shrink-0",
    userButtonAvatarImage: "size-full",
    userButtonOuterIdentifier:
      "flex-1 text-sm font-normal group-data-[collapsible=icon]:hidden",
  },
}

export function AppSidebar({ chats }: { chats: UserChat[] }) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)

  return (
    <>
      <Sidebar className="shadow-lg">
        <SidebarHeader>
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="secondary" size="icon-sm" />}
              >
                <PlusIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="end"
                className="w-max"
              >
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setBotDialogOpen(true)}>
                    <PlusIcon />
                    Create new bot
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UsersIcon />
                    Create group chat
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton size="lg" className="h-auto">
                      {chat.avatar && (
                        <ChatAvatar seed={chat.avatar} className="shrink-0" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {chat.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNowStrict(chat.lastMessageAt)}
                          </span>
                        </div>
                        <span className="truncate text-xs text-muted-foreground">
                          {chat.lastMessagePreview}
                        </span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserButton showName appearance={userButtonAppearance} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <BotDialog
        open={botDialogOpen}
        onOpenChange={setBotDialogOpen}
        showTrigger={false}
      />
    </>
  )
}
