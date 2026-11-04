"use server"

import { redirect } from "next/navigation"
import { refresh } from "next/cache"
import { z } from "zod"

import { createSupabaseServerClient } from "@euaggelion/auth/server"
import { datePrecision, MdxSyntaxError, parseMdx, WORK_TYPES, type SegmentKind } from "@euaggelion/mdx"

import { databaseErrorMessage, type ActionState } from "@/lib/action-state"
import { requireLuther } from "@/lib/access"
import { slugify, WORK_STATUSES } from "@/lib/format"

const MAX_MDX_LENGTH = 2_000_000

/** Resultado da pré-visualização de um MDX (sem gravar nada). */
export interface MdxPreview {
  error?: string
  metadata?: {
    title: string
    author: string
    type: string
    description?: string
    date?: string
    source?: string
    credits?: string
    slug: string
  }
  issues: { message: string; path?: string }[]
  segments: { position: number; kind: SegmentKind; text: string }[]
  /** Autor do frontmatter já cadastrado? (só na criação de obra) */
  author?: { slug: string; name: string | null }
}

function readMdx(raw: FormDataEntryValue | null): string | null {
  const mdx = typeof raw === "string" ? raw : ""
  return mdx.trim() && mdx.length <= MAX_MDX_LENGTH ? mdx : null
}

/** Pré-visualiza a segmentação de um MDX. Só administradores importam textos. */
export async function previewMdx(mdx: string, options: { checkAuthor?: boolean } = {}): Promise<MdxPreview> {
  await requireLuther(["admin"])
  if (!mdx.trim()) return { error: "Cole ou envie um arquivo MDX.", issues: [], segments: [] }
  if (mdx.length > MAX_MDX_LENGTH) return { error: "O arquivo é grande demais (limite de 2 MB).", issues: [], segments: [] }

  let parsed
  try {
    parsed = parseMdx(mdx)
  } catch (error) {
    if (error instanceof MdxSyntaxError) return { error: `MDX inválido: ${error.message}`, issues: [], segments: [] }
    throw error
  }

  const preview: MdxPreview = {
    issues: parsed.frontmatterIssues.map(({ message, path }) => ({ message, path })),
    segments: parsed.segments.map(({ position, kind, text }) => ({ position, kind, text })),
  }
  if (parsed.metadata) {
    const m = parsed.metadata
    preview.metadata = {
      title: m.title,
      author: m.author,
      type: m.type,
      description: m.description,
      date: m.date,
      source: m.source,
      credits: m.credits,
      slug: m.slug ?? slugify(m.title),
    }
  }
  if (parsed.segments.length === 0) preview.issues.push({ message: "O texto não tem nenhum segmento traduzível." })

  if (options.checkAuthor && parsed.metadata) {
    const slug = slugify(parsed.metadata.author)
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.from("authors").select("name").eq("slug", slug).maybeSingle()
    preview.author = { slug, name: data?.name ?? null }
  }
  return preview
}

/** Cria a obra (rascunho) e a versão 1 do original a partir de um MDX. */
export async function createWork(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin"])
  const mdx = readMdx(formData.get("mdx"))
  if (!mdx) return { error: "Cole ou envie um arquivo MDX (até 2 MB)." }

  let parsed
  try {
    parsed = parseMdx(mdx)
  } catch (error) {
    if (error instanceof MdxSyntaxError) return { error: `MDX inválido: ${error.message}` }
    throw error
  }
  const metadata = parsed.metadata
  if (!metadata) return { error: "Corrija o frontmatter antes de criar a obra." }
  if (parsed.segments.length === 0) return { error: "O texto não tem nenhum segmento traduzível." }

  const supabase = await createSupabaseServerClient()
  const authorSlug = slugify(metadata.author)
  let { data: author } = await supabase.from("authors").select("id").eq("slug", authorSlug).maybeSingle()

  if (!author) {
    const name = String(formData.get("authorName") ?? "").trim()
    if (!name) return { fieldErrors: { authorName: "Informe o nome do novo autor." } }
    const created = await supabase.from("authors").insert({ name, slug: authorSlug }).select("id").single()
    if (created.error) return { error: databaseErrorMessage(created.error) }
    author = created.data
  }

  const { data: workId, error } = await supabase.rpc("create_work", {
    p_author_id: author.id,
    p_type: metadata.type,
    p_slug: metadata.slug ?? slugify(metadata.title),
    p_mdx: parsed.source,
    p_segments: parsed.segments as never,
    p_frontmatter: parsed.frontmatter as never,
    p_date_text: metadata.date,
    p_date_precision: datePrecision(metadata.date),
    p_source: metadata.source,
    p_credits: metadata.credits,
  })
  if (error) return { error: databaseErrorMessage(error) }
  redirect(`/works/${workId}`)
}

/** Nova versão (imutável) do original, por exemplo para corrigir um erro no texto em inglês. */
export async function createSourceVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin"])
  const workId = String(formData.get("workId") ?? "")
  const notes = String(formData.get("notes") ?? "").trim()
  const mdx = readMdx(formData.get("mdx"))
  if (!mdx) return { error: "Cole ou envie um arquivo MDX (até 2 MB)." }
  if (!notes) return { fieldErrors: { notes: "Descreva o que mudou nesta versão." } }

  let parsed
  try {
    parsed = parseMdx(mdx)
  } catch (error) {
    if (error instanceof MdxSyntaxError) return { error: `MDX inválido: ${error.message}` }
    throw error
  }
  if (!parsed.metadata) return { error: "Corrija o frontmatter antes de criar a versão." }
  if (parsed.segments.length === 0) return { error: "O texto não tem nenhum segmento traduzível." }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("create_source_version", {
    p_work_id: workId,
    p_mdx: parsed.source,
    p_segments: parsed.segments as never,
    p_frontmatter: parsed.frontmatter as never,
    p_notes: notes,
  })
  if (error) return { error: databaseErrorMessage(error) }
  redirect(`/works/${workId}`)
}

const workSchema = z.object({
  id: z.uuid(),
  authorId: z.uuid({ message: "Escolha o autor." }),
  type: z.enum(WORK_TYPES, { message: "Escolha o tipo." }),
  status: z.enum(WORK_STATUSES, { message: "Escolha o status." }),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens."),
  date: z
    .string()
    .trim()
    .regex(/^(\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?)?$/, "Use AAAA, AAAA-MM ou AAAA-MM-DD."),
  source: z.string().trim(),
  credits: z.string().trim(),
})

/** Edita os metadados da obra. Título e descrição vêm do original (nova versão do original). */
export async function updateWork(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin"])
  const parsed = workSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
    }
  }
  const w = parsed.data
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from("works")
    .update({
      author_id: w.authorId,
      type: w.type,
      status: w.status,
      slug: w.slug,
      date_text: w.date || null,
      date_precision: datePrecision(w.date || undefined) ?? null,
      source: w.source || null,
      credits: w.credits || null,
    })
    .eq("id", w.id)
  if (error) return { error: databaseErrorMessage(error) }
  refresh()
  return { success: "Obra atualizada." }
}

const translationSchema = z.object({
  workId: z.uuid(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Idioma inválido."),
  mode: z.enum(["copy", "blank"]),
})

/** Inicia a próxima versão da tradução de uma obra num idioma e abre o editor. */
export async function startTranslation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireLuther(["admin", "reviewer"])
  const parsed = translationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." }
  const { workId, language, mode } = parsed.data

  const supabase = await createSupabaseServerClient()
  const { data: versionId, error } = await supabase.rpc("create_translation_version", {
    p_work_id: workId,
    p_language: language,
    p_mode: mode,
  })
  if (error) {
    if (error.code === "23505") return { error: "Já existe uma versão em andamento para este idioma." }
    return { error: databaseErrorMessage(error) }
  }
  const { data: version } = await supabase.from("translation_versions").select("version").eq("id", versionId).single()
  redirect(`/works/${workId}/${language}/v/${version?.version ?? 1}`)
}
