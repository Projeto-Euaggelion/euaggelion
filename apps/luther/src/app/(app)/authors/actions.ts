"use server"

import { redirect } from "next/navigation"
import { refresh } from "next/cache"
import { z } from "zod"

import { createSupabaseServerClient } from "@euaggelion/auth/server"

import { databaseErrorMessage, type ActionState } from "@/lib/action-state"
import { requireLuther } from "@/lib/access"

const authorSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens."),
  era: z.string().trim(),
  bio: z.string().trim(),
})

function parseAuthor(formData: FormData) {
  const raw = Object.fromEntries(formData)
  return authorSchema.safeParse({ ...raw, id: raw.id || undefined })
}

function fieldErrors(error: z.ZodError): ActionState {
  return { fieldErrors: Object.fromEntries(error.issues.map((i) => [String(i.path[0]), i.message])) }
}

/** Cadastra um autor (somente administradores). */
export async function createAuthor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin"])
  const parsed = parseAuthor(formData)
  if (!parsed.success) return fieldErrors(parsed.error)

  const { name, slug, era, bio } = parsed.data
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from("authors").insert({ name, slug, era: era || null, bio: bio || null })
  if (error) return { error: databaseErrorMessage(error) }
  redirect(`/authors/${slug}`)
}

/** Edita um autor (somente administradores). */
export async function updateAuthor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin"])
  const parsed = parseAuthor(formData)
  if (!parsed.success) return fieldErrors(parsed.error)
  if (!parsed.data.id) return { error: "Autor não informado." }

  const { id, name, slug, era, bio } = parsed.data
  const supabase = await createSupabaseServerClient()
  const { data: before } = await supabase.from("authors").select("slug").eq("id", id).single()
  const { error } = await supabase.from("authors").update({ name, slug, era: era || null, bio: bio || null }).eq("id", id)
  if (error) return { error: databaseErrorMessage(error) }
  if (before && before.slug !== slug) redirect(`/authors/${slug}`)
  refresh()
  return { success: "Autor atualizado." }
}
