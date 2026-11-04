import type { NextConfig } from "next"

/**
 * Zona do Luther (multi-zones): servida em /luther no domínio do Euaggelion.
 * A zona principal (apps/site) encaminha /luther/* para cá e serve o /login único.
 */
const publicHost = new URL(process.env.EUAGGELION_URL ?? "http://localhost:3000").host

const nextConfig: NextConfig = {
  basePath: "/luther",
  transpilePackages: ["@euaggelion/ui", "@euaggelion/auth", "@euaggelion/mdx", "@euaggelion/db"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Server Actions chegam pela origem pública (zona principal), não pela origem desta zona
    serverActions: { allowedOrigins: [publicHost] },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
