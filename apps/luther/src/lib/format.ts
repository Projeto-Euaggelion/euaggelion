import type { SegmentKind, WorkType } from "@euaggelion/mdx/schema"

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  sermon: "Sermão",
  article: "Artigo",
  commentary: "Comentário",
}

export const SEGMENT_KIND_LABELS: Record<SegmentKind, string> = {
  title: "Título",
  description: "Descrição",
  heading: "Seção",
  paragraph: "Parágrafo",
  list_item: "Item",
  quote: "Citação",
  footnote: "Nota",
  attribute: "Atributo",
}

export const WORK_STATUSES = ["draft", "active", "archived"] as const
export type WorkStatus = (typeof WORK_STATUSES)[number]

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  draft: "Rascunho",
  active: "Ativa",
  archived: "Arquivada",
}

export const VERSION_STATUS_LABELS: Record<string, string> = {
  in_progress: "Em andamento",
  published: "Publicada",
  archived: "Arquivada",
}

/** Idiomas de destino oferecidos na interface (o banco aceita qualquer código xx ou xx-YY). */
export const TARGET_LANGUAGES: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  es: "Espanhol",
}

export function languageLabel(code: string): string {
  return TARGET_LANGUAGES[code] ?? code
}

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."]

/** Data da obra conforme a precisão: "1855", "jan. 1855" ou "7 jan. 1855". */
export function formatWorkDate(dateText: string | null): string | null {
  if (!dateText) return null
  const [year, month, day] = dateText.split("-")
  if (!month) return year!
  const m = MONTHS[Number(month) - 1] ?? month
  return day ? `${Number(day)} ${m} ${year}` : `${m} ${year}`
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(
    new Date(iso),
  )
}

/** Slug ASCII (minúsculas, números e hífens), como exigido pelo banco. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}
