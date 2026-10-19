import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import definition from "@dicebear/styles/gaze.json" with { type: "json" }

const style = new Style(definition)

type ChatAvatarProps = {
  seed: string
  animated?: boolean
  className?: string
}

function ChatAvatar({ seed, animated = false, className }: ChatAvatarProps) {
  const src = new Avatar(style, {
    seed,
    animationVariant: animated ? ["medium"] : ["none"],
  }).toDataUri()

  return <Image src={src} alt="" width={32} height={32} className={className} />
}

export { ChatAvatar }
