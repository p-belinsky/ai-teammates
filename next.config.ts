import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The Daytona SDK loads busboy with a dynamic require, which Next's bundler can't follow
  serverExternalPackages: ["@daytona/sdk"],
}

export default nextConfig
