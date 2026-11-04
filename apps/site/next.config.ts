import type { NextConfig } from "next"

/**
 * Zona principal do Euaggelion (multi-zones): serve "/", o login único e as
 * rotas de autenticação, e encaminha os caminhos de cada app para a sua zona.
 */
const LUTHER_ORIGIN = process.env.LUTHER_ORIGIN ?? "http://localhost:3001"

const nextConfig: NextConfig = {
  transpilePackages: ["@euaggelion/ui", "@euaggelion/auth", "@euaggelion/db"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/luther", destination: `${LUTHER_ORIGIN}/luther` },
      { source: "/luther/:path*", destination: `${LUTHER_ORIGIN}/luther/:path*` },
    ]
  },
}

export default nextConfig
