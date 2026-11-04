import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { AUTH_PATHS, safeNextPath } from "@euaggelion/auth/redirect"
import { createSupabaseServerClient } from "@euaggelion/auth/server"

/** Retorno do link mágico / convite / recuperação: cria a sessão e segue para `next`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeNextPath(searchParams.get("next"), "/")
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  const supabase = await createSupabaseServerClient()
  let ok = false
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error
  }

  const target = ok ? next : `${AUTH_PATHS.login}?next=${encodeURIComponent(next)}&erro=link`
  return NextResponse.redirect(new URL(target, request.url), { status: 303 })
}
