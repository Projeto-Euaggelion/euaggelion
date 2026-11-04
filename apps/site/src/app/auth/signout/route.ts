import { NextResponse, type NextRequest } from "next/server"

import { AUTH_PATHS } from "@euaggelion/auth/redirect"
import { createSupabaseServerClient } from "@euaggelion/auth/server"

/** Logout único: encerra a sessão em todas as aplicações do Euaggelion. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL(AUTH_PATHS.login, request.url), { status: 303 })
}
