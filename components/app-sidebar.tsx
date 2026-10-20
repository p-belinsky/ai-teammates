"use client"

import * as React from "react"
import { UserButton } from "@clerk/nextjs"
import { formatDistanceToNowStrict } from "date-fns"
import { PlusIcon, SearchIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import type { UserChat } from "@/queries/bots"

const userButtonAppearance = {
  elements: {
    rootBox: "w-full",
    userButtonTrigger:
      "flex h-8 w-full! cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 after:absolute after:inset-0 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-1!",
    userButtonBox: "flex w-full! flex-row items-center gap-2",
    userButtonAvatarBox: "order-first size-[1.5rem] shrink-0",
    userButtonAvatarImage: "size-full",
    userButtonOuterIdentifier:
      "flex-1 text-sm font-normal group-data-[collapsible=icon]:hidden",
  },
}

export function AppSidebar({ chats }: { chats: UserChat[] }) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const router = useRouter()
  const { chatId } = useParams<{ chatId?: string }>()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <Sidebar className="shadow-lg" collapsible="icon">
        <SidebarHeader>
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="secondary" size="icon" />}
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
          <Button
            variant={collapsed ? "secondary" : "outline"}
            size={collapsed ? "icon" : "default"}
            className={cn(
              !collapsed &&
                "h-8 w-full min-w-0 justify-start rounded-lg border border-input bg-transparent px-2.5 py-1 text-base font-normal transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            )}
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon data-icon="inline-start" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left text-muted-foreground">
                  Search
                </span>
                <Kbd>⌘K</Kbd>
              </>
            )}
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      size="lg"
                      className="h-auto"
                      isActive={chat.id === chatId}
                      render={<Link href={`/chats/${chat.id}`} />}
                    >
                      {chat.avatar && (
                        <ChatAvatar seed={chat.avatar} className="shrink-0" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
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
        <SidebarRail />
      </Sidebar>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search chats"
        description="Find a chat by name or last message."
      >
        <Command>
          <CommandInput placeholder="Search chats..." />
          <CommandList>
            <CommandEmpty>No chats found.</CommandEmpty>
            <CommandGroup heading="Chats">
              {chats.map((chat) => (
                <CommandItem
                  key={chat.id}
                  value={chat.id}
                  keywords={[chat.name, chat.lastMessagePreview ?? ""]}
                  onSelect={() => {
                    setSearchOpen(false)
                    router.push(`/chats/${chat.id}`)
                  }}
                >
                  {chat.avatar && (
                    <ChatAvatar seed={chat.avatar} className="shrink-0" />
                  )}
                  <span className="truncate">{chat.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      <BotDialog
        open={botDialogOpen}
        onOpenChange={setBotDialogOpen}
        showTrigger={false}
      />
    </>
  )
}
