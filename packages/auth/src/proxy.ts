import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { loginPath } from "./redirect"

/**
 * Renova a sessão do Supabase (cookies) a cada requisição e, se `requireAuth`,
 * manda quem não está logado para o /login único do Euaggelion.
 *
 * É uma checagem otimista (só sessão). A autorização por app/papel é feita no
 * servidor pela DAL (`requireAppAccess`), perto dos dados.
 */
export async function updateSession(request: NextRequest, options: { requireAuth?: boolean } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  let response = NextResponse.next({ request })
  let authenticated = false

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    // Não coloque código entre a criação do cliente e getUser(): é aqui que a sessão é renovada.
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    authenticated = Boolean(data.user)
  }

  if (options.requireAuth && !authenticated) {
    const { basePath, pathname, search } = request.nextUrl
    const current = basePath && pathname === "/" ? basePath : `${basePath}${pathname}`
    // Origem pública: a zona pode estar atrás de rewrite (a origem da requisição é a interna)
    const origin = process.env.EUAGGELION_URL ?? "http://localhost:3000"
    const redirect = NextResponse.redirect(new URL(loginPath(current + search), origin), 307)
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  return response
}
