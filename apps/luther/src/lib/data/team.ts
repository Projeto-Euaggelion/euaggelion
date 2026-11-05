import "server-only"

import { createSupabaseAdminClient } from "@euaggelion/auth/server"
import { LUTHER_ROLES, type LutherRole } from "@euaggelion/db/apps"

/**
 * Equipe do Luther. app_memberships não é exposta à API do client, então esta leitura usa a
 * chave secreta: chame só depois de confirmar que a conta é admin (a página e as ações fazem isso).
 */

export type MemberStatus = "active" | "invited" | "inactive"

export interface TeamMember {
  userId: string
  name: string
  email: string
  role: LutherRole
  status: MemberStatus
  /** Quando recebeu acesso ao Luther. */
  since: string
  grantedBy: string | null
  lastSignInAt: string | null
}

/** "invited": convidado por e-mail e ainda não entrou. */
const STATUS_ORDER: Record<MemberStatus, number> = { active: 0, invited: 1, inactive: 2 }

export async function listTeam(): Promise<TeamMember[]> {
  const admin = createSupabaseAdminClient()
  const { data: memberships, error } = await admin
    .from("app_memberships")
    .select("user_id, role, active, created_at, granted_by")
    .eq("app", "luther")
  if (error) throw new Error(`Falha ao carregar a equipe: ${error.message}`)
  if (!memberships.length) return []

  const ids = [...new Set(memberships.flatMap((m) => [m.user_id, m.granted_by]).filter((id): id is string => !!id))]
  const [{ data: profiles, error: profilesError }, authInfos] = await Promise.all([
    admin.from("profiles").select("id, name, email").in("id", ids),
    Promise.all(memberships.map((m) => authInfo(m.user_id))),
  ])
  if (profilesError) throw new Error(`Falha ao carregar os perfis: ${profilesError.message}`)
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return memberships
    .map((m, i): TeamMember => {
      const profile = byId.get(m.user_id)
      const { lastSignInAt, invitedAt } = authInfos[i]!
      return {
        userId: m.user_id,
        name: profile?.name ?? "—",
        email: profile?.email ?? "",
        role: (LUTHER_ROLES as readonly string[]).includes(m.role) ? (m.role as LutherRole) : "translator",
        status: !m.active ? "inactive" : !lastSignInAt && invitedAt ? "invited" : "active",
        since: m.created_at,
        grantedBy: m.granted_by ? (byId.get(m.granted_by)?.name ?? null) : null,
        lastSignInAt,
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, "pt-BR"))
}

/** Último acesso e convite (Supabase Auth). Convidado que nunca entrou = convite pendente. */
async function authInfo(userId: string): Promise<{ lastSignInAt: string | null; invitedAt: string | null }> {
  const { data } = await createSupabaseAdminClient().auth.admin.getUserById(userId)
  return { lastSignInAt: data.user?.last_sign_in_at ?? null, invitedAt: data.user?.invited_at ?? null }
}
