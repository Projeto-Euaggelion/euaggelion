import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import {
  EUAGGELION_APP_CONFIG,
  EUAGGELION_APP_IDS,
  type EuaggelionAppId,
  type LutherRole,
} from "@euaggelion/db/apps"

import { authEnv } from "./env"
import { AUTH_PATHS, loginPath } from "./redirect"
import { createSupabaseAdminClient, createSupabaseServerClient } from "./server"

/**
 * Data Access Layer de autenticação/autorização.
 * Tudo aqui roda só no servidor: o client recebe apenas o que precisa renderizar
 * (nome e e-mail da conta, apps disponíveis), nunca papéis ou regras.
 */

export interface Account {
  id: string
  name: string
  email: string
}

type RoleOf<A extends EuaggelionAppId> = A extends "luther" ? LutherRole : string

export interface AppAccess<A extends EuaggelionAppId> {
  account: Account
  role: RoleOf<A>
}

/** Conta autenticada da requisição atual (ou null). Deduplicado por requisição. */
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", data.user.id)
    .maybeSingle()

  return {
    id: data.user.id,
    name: profile?.name ?? data.user.email?.split("@")[0] ?? "Usuário",
    email: profile?.email ?? data.user.email ?? "",
  }
})

/** Memberships ativas da conta (lidas com a chave secreta: a tabela não é exposta ao client). */
const getMemberships = cache(async (userId: string): Promise<Map<EuaggelionAppId, string>> => {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("app_memberships")
    .select("app, role")
    .eq("user_id", userId)
    .eq("active", true)
  if (error) throw new Error(`Falha ao verificar acesso: ${error.message}`)
  return new Map((data ?? []).map((m) => [m.app as EuaggelionAppId, m.role as string]))
})

/** Papel da conta atual num app (null = sem acesso). */
export async function getAppRole<A extends EuaggelionAppId>(app: A): Promise<RoleOf<A> | null> {
  const account = await getAccount()
  if (!account) return null
  const memberships = await getMemberships(account.id)
  return (memberships.get(app) as RoleOf<A> | undefined) ?? null
}

/** Apps que a conta atual pode abrir (públicos + aqueles em que tem membership). */
export async function getAccessibleApps(): Promise<EuaggelionAppId[]> {
  const account = await getAccount()
  const memberships = account ? await getMemberships(account.id) : new Map()
  return EUAGGELION_APP_IDS.filter(
    (id) => EUAGGELION_APP_CONFIG[id].access === "public" || memberships.has(id),
  )
}

/** Redireciona para fora do basePath da zona (as rotas de auth ficam no apps/site). */
function redirectToRoot(path: string): never {
  redirect(new URL(path, authEnv.publicOrigin()).toString())
}

/**
 * Exige login e acesso ao app (e, opcionalmente, um dos papéis).
 * Sem sessão → /login?next=…; sem acesso → /sem-acesso?app=….
 * Chame em layouts/páginas (dentro de <Suspense>), Server Actions e Route Handlers.
 */
export async function requireAppAccess<A extends EuaggelionAppId>(
  app: A,
  options: { roles?: RoleOf<A>[]; next?: string } = {},
): Promise<AppAccess<A>> {
  const account = await getAccount()
  if (!account) redirectToRoot(loginPath(options.next ?? EUAGGELION_APP_CONFIG[app].path))

  const role = await getAppRole(app)
  if (!role || (options.roles && !options.roles.includes(role))) {
    redirectToRoot(`${AUTH_PATHS.noAccess}?app=${app}`)
  }
  return { account, role }
}
