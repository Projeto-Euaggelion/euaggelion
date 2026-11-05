import type { NextConfig } from "next"

/**
 * Zona principal do Euaggelion (multi-zones): serve "/", o login único e as
 * rotas de autenticação, e encaminha os caminhos de cada app para a sua zona.
 */
// Em produção (Cloudflare Workers) cada zona tem a sua rota no domínio, então não há rewrite:
// /luther* vai direto ao Worker do Luther. O rewrite só existe se LUTHER_ORIGIN estiver definido
// no build (ou em `next dev`, apontando para a porta 3001). Sem ele, /luther é um 404 do site.
const LUTHER_ORIGIN =
  process.env.LUTHER_ORIGIN || (process.env.NODE_ENV === "development" ? "http://localhost:3001" : undefined)

// Cache Components (renderização parcial do Next 16) ainda não roda nos Cloudflare Workers: com o
// OpenNext 1.20 as páginas travam no workerd ("Worker's code had hung"). Fica desligado em todos os
// ambientes, para dev e produção se comportarem igual; as páginas renderizam sob demanda e o
// padrão de dados dentro de <Suspense> continua valendo (streaming). Para testar de novo quando o
// adaptador suportar: NEXT_CACHE_COMPONENTS=1 (no build) e `pnpm cf:preview`.
const cacheComponents = process.env.NEXT_CACHE_COMPONENTS === "1"

const nextConfig: NextConfig = {
  transpilePackages: ["@euaggelion/ui", "@euaggelion/auth", "@euaggelion/db"],
  cacheComponents,
  partialPrefetching: cacheComponents,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (!LUTHER_ORIGIN) return []
    return [
      { source: "/luther", destination: `${LUTHER_ORIGIN}/luther` },
      { source: "/luther/:path*", destination: `${LUTHER_ORIGIN}/luther/:path*` },
    ]
  },
}

export default nextConfig
