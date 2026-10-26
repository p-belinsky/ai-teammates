import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import definition from "@dicebear/styles/gaze.json" with { type: "json" }

const style = new Style(definition)

type ChatAvatarProps = {
  seed: string
  animated?: boolean
  className?: string
}

// A bot's face as an image source, so a group chat can draw several of them
function botFaceSrc(seed: string, animated = false) {
  return new Avatar(style, {
    seed,
    animationVariant: animated ? ["medium"] : ["none"],
  }).toDataUri()
}

function ChatAvatar({ seed, animated = false, className }: ChatAvatarProps) {
  const src = botFaceSrc(seed, animated)

  return <Image src={src} alt="" width={32} height={32} className={className} />
}

export { ChatAvatar, botFaceSrc }
