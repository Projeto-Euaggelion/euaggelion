import { z } from "zod"

/** Tipos de obra (espelha `public.work_type`). */
export const WORK_TYPES = ["sermon", "article", "commentary"] as const
export type WorkType = (typeof WORK_TYPES)[number]

/** Etapas do fluxo editorial (espelha `public.segment_stage`). */
export const SEGMENT_STAGES = ["original", "translation", "review", "discussion", "approved"] as const
export type SegmentStage = (typeof SEGMENT_STAGES)[number]

/** Tipos de segmento (espelha `public.segment_kind`). */
export const SEGMENT_KINDS = [
  "title",
  "description",
  "heading",
  "paragraph",
  "list_item",
  "quote",
  "footnote",
  "attribute",
] as const
export type SegmentKind = (typeof SEGMENT_KINDS)[number]

export const SOURCE_LANGUAGE = "en" as const

/** Precisão da data (espelha `public.date_precision`). */
export type DatePrecision = "year" | "month" | "day"

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/

/** Campos do frontmatter que viram segmentos traduzíveis. */
export const TRANSLATABLE_FRONTMATTER = ["title", "description"] as const

/**
 * Frontmatter de uma obra. `title` e `description` são traduzíveis. Os demais campos são
 * metadados da obra e ficam iguais na tradução.
 */
export const frontmatterSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título."),
    author: z.string().trim().min(1, "Informe o autor."),
    type: z.enum(WORK_TYPES, { message: "Tipo deve ser sermon, article ou commentary." }),
    description: z.string().trim().min(1).optional(),
    // YAML lê `1857` como número
    date: z
      .union([z.string(), z.number().int()])
      .transform(String)
      .refine((v) => DATE_RE.test(v), "Data deve ser AAAA, AAAA-MM ou AAAA-MM-DD.")
      .optional(),
    source: z.string().trim().min(1).optional(),
    credits: z.string().trim().min(1).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug deve ter só letras minúsculas, números e hífens.")
      .optional(),
  })
  .passthrough()

export type Frontmatter = z.infer<typeof frontmatterSchema>

export function datePrecision(date: string | undefined): DatePrecision | undefined {
  if (!date) return undefined
  const parts = date.split("-").length
  return parts === 1 ? "year" : parts === 2 ? "month" : "day"
}

/**
 * Componentes MDX conhecidos.
 * - `kind`: tipo dos segmentos dentro do componente (quando ele envolve blocos);
 * - `translatableAttributes`: atributos cujo valor é traduzido (viram segmentos `attribute`).
 *   Os demais atributos são preservados e nunca vão para a IA.
 */
export const MDX_COMPONENTS = {
  Scripture: { kind: "quote", translatableAttributes: [] },
  Quote: { kind: "quote", translatableAttributes: ["source"] },
  Note: { kind: "paragraph", translatableAttributes: [] },
} as const satisfies Record<string, { kind: SegmentKind; translatableAttributes: readonly string[] }>

export type MdxComponentName = keyof typeof MDX_COMPONENTS

export function isKnownComponent(name: string | null | undefined): name is MdxComponentName {
  return !!name && Object.hasOwn(MDX_COMPONENTS, name)
}
