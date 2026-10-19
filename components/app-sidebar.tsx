import { UserButton } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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

export function AppSidebar() {
  return (
    <Sidebar className="shadow-lg">
      <SidebarFooter className="mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserButton showName appearance={userButtonAppearance} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
