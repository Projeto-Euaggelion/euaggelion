"use server"

import { redirect } from "next/navigation"

import { AUTH_PATHS, safeNextPath } from "@euaggelion/auth/redirect"
import { createSupabaseServerClient } from "@euaggelion/auth/server"

export interface LoginState {
  error?: string
  message?: string
  email?: string
}

const ORIGIN = () => process.env.EUAGGELION_URL ?? "http://localhost:3000"

/**
 * Login único do Euaggelion. Autentica a conta; o acesso a cada app é decidido
 * depois, no servidor de cada zona (requireAppAccess).
 */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const intent = String(formData.get("intent") ?? "password")
  const next = safeNextPath(String(formData.get("next") ?? ""), "/")

  if (!email || !email.includes("@")) return { error: "Informe um e-mail válido.", email }

  const supabase = await createSupabaseServerClient()

  if (intent === "magic") {
    const callback = new URL(AUTH_PATHS.callback, ORIGIN())
    callback.searchParams.set("next", next)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Sem cadastro público: só contas existentes recebem o link
      options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
    })
    // Resposta neutra: não revela se o e-mail tem conta
    if (error && error.status !== 422 && error.status !== 400) {
      return { error: "Não foi possível enviar o link agora. Tente novamente.", email }
    }
    return { message: "Se houver uma conta com esse e-mail, enviamos um link de acesso.", email }
  }

  if (!password) return { error: "Informe a senha ou peça um link por e-mail.", email }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: "E-mail ou senha inválidos.", email }

  redirect(next)
}
