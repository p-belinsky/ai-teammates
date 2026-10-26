import Image from "next/image"

import { botFaceSrc } from "@/components/chat-avatar"
import { cn } from "@/lib/utils"

// Three bots are drawn at most; a fourth cell shows how many are left
const DRAWN_LIMIT = 3

type GroupChatAvatarProps = {
  seeds: string[]
  className?: string
}

function Face({ seed, className }: { seed: string; className?: string }) {
  return (
    <Image
      src={botFaceSrc(seed)}
      alt=""
      width={32}
      height={32}
      className={cn("rounded-full", className)}
    />
  )
}

// Same 32px box as ChatAvatar, so a group chat takes up the space of a direct one.
// Two bots sit side by side, three form a triangle, and four or more fill a 2x2 grid.
function GroupChatAvatar({ seeds, className }: GroupChatAvatarProps) {
  const drawn = seeds.slice(0, DRAWN_LIMIT)
  const hidden = seeds.length - drawn.length

  if (seeds.length === 2) {
    return (
      <div className={cn("flex size-8 shrink-0 items-center", className)}>
        <Face seed={drawn[0]} className="size-5" />
        <Face seed={drawn[1]} className="-ml-2 size-5 ring-1 ring-background" />
      </div>
    )
  }

  if (seeds.length === 3) {
    return (
      <div className={cn("relative size-8 shrink-0", className)}>
        <Face
          seed={drawn[0]}
          className="absolute top-0 left-1/2 size-[18px] -translate-x-1/2 ring-1 ring-background"
        />
        <Face
          seed={drawn[1]}
          className="absolute bottom-0 left-0 size-[18px] ring-1 ring-background"
        />
        <Face
          seed={drawn[2]}
          className="absolute right-0 bottom-0 size-[18px] ring-1 ring-background"
        />
      </div>
    )
  }

  return (
    <div
      className={cn("grid size-8 shrink-0 grid-cols-2 grid-rows-2", className)}
    >
      {drawn.map((seed, index) => (
        <Face key={index} seed={seed} className="size-full" />
      ))}
      {hidden > 0 && (
        <span className="flex items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          +{hidden}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
