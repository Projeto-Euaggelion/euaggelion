"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { authEnv } from "@euaggelion/auth/env"
import { AUTH_PATHS } from "@euaggelion/auth/redirect"
import { createSupabaseAdminClient } from "@euaggelion/auth/server"
import { LUTHER_ROLES } from "@euaggelion/db/apps"

import { databaseErrorMessage, type ActionState } from "@/lib/action-state"
import { requireLuther } from "@/lib/access"

/**
 * Gestão da equipe do Luther (somente administradores).
 * app_memberships só é gravada aqui, no servidor, com a chave secreta; cada ação confere o
 * papel de novo. O banco ainda impede que o Luther fique sem admin ativo.
 */

const roleSchema = z.enum(LUTHER_ROLES, { error: "Escolha um papel." })
const nameSchema = z.string().trim().min(1, "Informe o nome.").max(120, "Nome longo demais.")

const inviteSchema = z.object({
  email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
  name: nameSchema,
  role: roleSchema,
})

const updateSchema = z.object({
  userId: z.guid(),
  name: nameSchema,
  role: roleSchema,
})

const userIdSchema = z.guid()

function fieldErrors(error: z.ZodError): ActionState {
  return { fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])) }
}

/** Link do e-mail de convite: o callback da zona principal cria a sessão e abre o Luther. */
function inviteRedirect() {
  const url = new URL(AUTH_PATHS.callback, authEnv.publicOrigin())
  url.searchParams.set("next", "/luther")
  return url.toString()
}

/**
 * Convida alguém para a equipe. Se a conta já existe no Euaggelion (ex.: leitor do site), só
 * concede o acesso ao Luther; senão, cria a conta por convite (Supabase Auth envia o e-mail).
 */
export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { account } = await requireLuther(["admin"])
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)
  const { email, name, role } = parsed.data

  const admin = createSupabaseAdminClient()
  const { data: existing, error: lookupError } = await admin
    .from("profiles")
    .select("id, name")
    .eq("email", email)
    .maybeSingle()
  if (lookupError) return { error: databaseErrorMessage(lookupError) }

  let userId = existing?.id
  if (userId) {
    const { data: membership } = await admin
      .from("app_memberships")
      .select("active")
      .eq("user_id", userId)
      .eq("app", "luther")
      .maybeSingle()
    if (membership?.active) return { fieldErrors: { email: "Esta pessoa já faz parte da equipe." } }
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: inviteRedirect(),
    })
    if (error || !data.user) return { error: `Não foi possível enviar o convite: ${error?.message ?? "sem resposta"}` }
    userId = data.user.id
  }

  const { error } = await admin
    .from("app_memberships")
    .upsert({ user_id: userId, app: "luther", role, active: true, granted_by: account.id }, { onConflict: "user_id,app" })
  if (error) return { error: databaseErrorMessage(error) }

  refresh()
  return existing
    ? { success: `${existing.name} já tinha conta no Euaggelion e agora tem acesso ao Luther.` }
    : { success: `Convite enviado para ${email}.` }
}

/** Edita o nome e o papel de alguém da equipe. */
export async function updateMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { account } = await requireLuther(["admin"])
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrors(parsed.error)
  const { userId, name, role } = parsed.data
  if (userId === account.id && role !== "admin") {
    return { fieldErrors: { role: "Você não pode tirar o seu próprio papel de administrador." } }
  }

  const admin = createSupabaseAdminClient()
  const { data: membership, error: membershipError } = await admin
    .from("app_memberships")
    .update({ role })
    .eq("user_id", userId)
    .eq("app", "luther")
    .select("user_id")
    .maybeSingle()
  if (membershipError) return { error: databaseErrorMessage(membershipError) }
  if (!membership) return { error: "Esta pessoa não faz parte da equipe." }

  const { error } = await admin.from("profiles").update({ name }).eq("id", userId)
  if (error) return { error: databaseErrorMessage(error) }

  refresh()
  return { success: "Dados atualizados." }
}

/** Desativa (sem apagar o histórico) ou reativa o acesso de alguém ao Luther. */
export async function setMemberActive(userId: string, active: boolean): Promise<ActionState> {
  const { account } = await requireLuther(["admin"])
  if (!userIdSchema.safeParse(userId).success || typeof active !== "boolean") return { error: "Dados inválidos." }
  if (userId === account.id && !active) return { error: "Você não pode desativar o seu próprio acesso." }

  const { data, error } = await createSupabaseAdminClient()
    .from("app_memberships")
    .update({ active })
    .eq("user_id", userId)
    .eq("app", "luther")
    .select("user_id")
    .maybeSingle()
  if (error) return { error: databaseErrorMessage(error) }
  if (!data) return { error: "Esta pessoa não faz parte da equipe." }

  refresh()
  return { success: active ? "Acesso reativado." : "Acesso desativado." }
}

/** Reenvia o convite de quem ainda não entrou. */
export async function resendInvite(userId: string): Promise<ActionState> {
  await requireLuther(["admin"])
  if (!userIdSchema.safeParse(userId).success) return { error: "Dados inválidos." }

  const admin = createSupabaseAdminClient()
  const { data: membership } = await admin
    .from("app_memberships")
    .select("active")
    .eq("user_id", userId)
    .eq("app", "luther")
    .maybeSingle()
  if (!membership?.active) return { error: "Esta pessoa não tem acesso ativo ao Luther." }

  const { data: user, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !user.user?.email) return { error: "Conta não encontrada." }
  if (user.user.last_sign_in_at) return { error: "Esta pessoa já entrou no Euaggelion; não há convite pendente." }

  const { error } = await admin.auth.admin.inviteUserByEmail(user.user.email, {
    data: user.user.user_metadata,
    redirectTo: inviteRedirect(),
  })
  if (error) return { error: `Não foi possível reenviar o convite: ${error.message}` }
  return { success: `Convite reenviado para ${user.user.email}.` }
}
