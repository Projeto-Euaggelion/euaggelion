import "server-only"

import { createSupabaseServerClient } from "@euaggelion/auth/server"
import type { Enums } from "@euaggelion/db"

/**
 * Leituras de autores e obras (somente servidor). Usam o cliente com a sessão do usuário,
 * então a RLS se aplica: só a equipe do Luther enxerga esses dados.
 */

export const WORKS_PAGE_SIZE = 50

export interface WorkFilters {
  q?: string
  author?: string
  type?: Enums<"work_type">
  status?: Enums<"work_status">
  page?: number
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context}: ${error.message}`)
}

/** Escapa curingas do ILIKE e caracteres reservados da sintaxe de filtros do PostgREST. */
function ilikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[,()]/g, " ")}%`
}

export async function listWorks(filters: WorkFilters) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, filters.page ?? 1)
  const from = (page - 1) * WORKS_PAGE_SIZE

  let query = supabase
    .from("works")
    .select(
      "id, slug, title, type, status, date_text, updated_at, author:authors!inner(id, name, slug), translations(language, published_version_id)",
      { count: "exact" },
    )
    .order("title")
    .range(from, from + WORKS_PAGE_SIZE - 1)

  if (filters.q) query = query.ilike("title", ilikePattern(filters.q))
  if (filters.author) query = query.eq("author.slug", filters.author)
  if (filters.type) query = query.eq("type", filters.type)
  if (filters.status) query = query.eq("status", filters.status)

  const { data, count, error } = await query
  if (error) fail("Falha ao listar obras", error)
  return { works: data, total: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / WORKS_PAGE_SIZE)) }
}

export async function getWork(workId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("works")
    .select(
      "id, slug, title, description, type, status, date_text, date_precision, source, credits, created_at, updated_at, author:authors!inner(id, name, slug)",
    )
    .eq("id", workId)
    .maybeSingle()
  if (error) fail("Falha ao carregar a obra", error)
  return data
}

export async function getSourceVersions(workId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("source_versions")
    .select("id, version, notes, created_at, segments:source_segments(count)")
    .eq("work_id", workId)
    .order("version", { ascending: false })
  if (error) fail("Falha ao carregar as versões do original", error)
  return data.map(({ segments, ...v }) => ({ ...v, segmentCount: segments[0]?.count ?? 0 }))
}

export async function getSourceVersion(workId: string, version: number) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("source_versions")
    .select("id, version, mdx, notes, created_at")
    .eq("work_id", workId)
    .eq("version", version)
    .maybeSingle()
  if (error) fail("Falha ao carregar a versão do original", error)
  return data
}

/** O PostgREST do Supabase devolve no máximo 1000 linhas por requisição (max_rows). */
const PAGE = 1000

export async function getSourceSegments(sourceVersionId: string) {
  const supabase = await createSupabaseServerClient()
  const all: { position: number; kind: Enums<"segment_kind">; text: string; ast_path: string }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("source_segments")
      .select("position, kind, text, ast_path")
      .eq("source_version_id", sourceVersionId)
      .order("position")
      .range(from, from + PAGE - 1)
    if (error) fail("Falha ao carregar os segmentos", error)
    all.push(...data)
    if (data.length < PAGE) return all
  }
}

/** Versões de tradução da obra, com progresso por etapa (view `translation_version_overview`). */
export async function getTranslationOverview(workId: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("translation_version_overview")
    .select("*")
    .eq("work_id", workId)
    .order("language")
    .order("version", { ascending: false })
  if (error) fail("Falha ao carregar as traduções", error)
  return data
}

export async function listAuthors() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("authors")
    .select("id, name, slug, era, works(count)")
    .order("name")
  if (error) fail("Falha ao listar autores", error)
  return data.map(({ works, ...a }) => ({ ...a, workCount: works[0]?.count ?? 0 }))
}

export async function getAuthor(slug: string) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("authors")
    .select("id, name, slug, era, bio")
    .eq("slug", slug)
    .maybeSingle()
  if (error) fail("Falha ao carregar o autor", error)
  return data
}
