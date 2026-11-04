/** Caminhos de autenticação, comuns a todas as zonas (servidos pelo apps/site). */
export const AUTH_PATHS = {
  login: "/login",
  noAccess: "/sem-acesso",
  callback: "/auth/callback",
  signOut: "/auth/signout",
} as const

/**
 * Aceita apenas caminhos relativos do próprio domínio (evita open redirect).
 * "/luther/works" → ok; "//evil.com", "https://evil.com", "luther" → fallback.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  try {
    const url = new URL(next, "http://x")
    if (url.host !== "x") return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

export function loginPath(next?: string) {
  return next ? `${AUTH_PATHS.login}?next=${encodeURIComponent(next)}` : AUTH_PATHS.login
}
