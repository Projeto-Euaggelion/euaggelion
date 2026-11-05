import type { NextConfig } from "next"

/**
 * Zona do Luther (multi-zones): servida em /luther no domínio do Euaggelion.
 * A zona principal (apps/site) encaminha /luther/* para cá e serve o /login único.
 */
const publicHost = new URL(process.env.EUAGGELION_URL ?? "http://localhost:3000").host

// Cache Components (renderização parcial do Next 16) ainda não roda nos Cloudflare Workers: com o
// OpenNext 1.20 as páginas travam no workerd ("Worker's code had hung"). Fica desligado em todos os
// ambientes, para dev e produção se comportarem igual; as páginas renderizam sob demanda e o
// padrão de dados dentro de <Suspense> continua valendo (streaming). Para testar de novo quando o
// adaptador suportar: NEXT_CACHE_COMPONENTS=1 (no build) e `pnpm cf:preview`.
const cacheComponents = process.env.NEXT_CACHE_COMPONENTS === "1"

const nextConfig: NextConfig = {
  basePath: "/luther",
  transpilePackages: ["@euaggelion/ui", "@euaggelion/auth", "@euaggelion/mdx", "@euaggelion/db"],
  cacheComponents,
  partialPrefetching: cacheComponents,
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
