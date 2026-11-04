import "server-only"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { authEnv } from "./env"

/**
 * Cliente Supabase com a sessão do usuário (cookies). Use em Server Components,
 * Server Actions e Route Handlers. As policies (RLS) se aplicam.
 */
export async function createSupabaseServerClient() {
  // A sessão é sempre de tempo de requisição (o cliente usa Date.now() ao validar o token)
  await connection()
  const cookieStore = await cookies()
  return createServerClient(authEnv.supabaseUrl(), authEnv.publishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Em Server Components os cookies são somente leitura; o proxy renova a sessão.
        }
      },
    },
  })
}

/**
 * Cliente com a chave secreta (ignora RLS). Somente para checagens de acesso
 * e administração no servidor, depois de identificar o usuário.
 */
export function createSupabaseAdminClient() {
  return createClient(authEnv.supabaseUrl(), authEnv.secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
