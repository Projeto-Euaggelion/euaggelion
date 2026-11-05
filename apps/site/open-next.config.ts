import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache"

/**
 * OpenNext (Cloudflare Workers). As páginas são dinâmicas (sessão) com shell pré-renderizado no
 * build; não há "use cache" nem revalidação, então o cache incremental só lê o que o build gerou
 * (Workers Static Assets, sem bucket R2). Quando houver revalidação (ex.: páginas públicas das
 * traduções), troque por r2IncrementalCache + um tag cache (D1 ou Durable Objects).
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
})
