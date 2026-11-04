import { stringify } from "yaml"

import { MdxSyntaxError, parseMdx, type WorkType } from "@euaggelion/mdx"

import type { LegacyAuthor } from "./authors"

/**
 * Conversão dos textos legados (`content/sermons`) para MDX no formato do Luther.
 *
 * Os arquivos vieram de páginas HTML convertidas: cabeçalho informal (título, "Fonte:", `---`),
 * bloco de autoria (título repetido, "by", nome, anos, data, copyright) e linhas quebradas a
 * ~70 colunas. A conversão é heurística: o resultado deve ser revisado antes da importação.
 */

export interface ConvertOptions {
  author: LegacyAuthor
  /** Nome do arquivo de origem (usado no aviso e como título de reserva). */
  file: string
  type: WorkType
}

export interface ConvertResult {
  mdx: string
  title: string
  slug: string
  date?: string
  source?: string
  credits?: string
  /** Pontos para conferir na revisão. */
  warnings: string[]
  /** O MDX gerado passa no parser e no schema do frontmatter? */
  valid: boolean
  error?: string
  segmentCount: number
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
]
const MONTH_RE = MONTHS.join("|")

/** Normaliza para comparar nomes/títulos: só letras e números, minúsculas, sem acentos. */
export function loose(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "unto", "with"])

/** "ARE WE SANCTIFIED" → "Are We Sanctified" (só para textos inteiramente em maiúsculas). */
export function titleCaseIfShouting(text: string): string {
  if (!/[A-Z]/.test(text) || /[a-z]/.test(text)) return text
  return text
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.replace(/^(\W*)(\w)/, (_, p, c: string) => p + c.toUpperCase())))
    .join("")
}

/** Texto sem marcação markdown, para análise. */
function plain(line: string): string {
  return line.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim()
}

interface DateMatch {
  date: string
  /** A linha é só a data (pode ser removida)? */
  whole: boolean
}

export function findDate(line: string): DateMatch | null {
  const text = plain(line)
  const pad = (n: number) => String(n).padStart(2, "0")
  let m = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i").exec(text)
  if (m) {
    const month = MONTHS.indexOf(m[1]!.toLowerCase()) + 1
    const day = Number(m[2])
    if (day >= 1 && day <= 31) return { date: `${m[3]}-${pad(month)}-${pad(day)}`, whole: isOnlyDate(text, m[0]) }
  }
  m = new RegExp(`\\b(${MONTH_RE}),?\\s+(\\d{4})\\b`, "i").exec(text)
  if (m) {
    const month = MONTHS.indexOf(m[1]!.toLowerCase()) + 1
    return { date: `${m[2]}-${pad(month)}`, whole: isOnlyDate(text, m[0]) }
  }
  m = /^(?:dated\s+)?(1[5-9]\d{2})\.?$/i.exec(text)
  if (m) return { date: m[1]!, whole: true }
  return null
}

function isOnlyDate(text: string, match: string): boolean {
  return text.replace(match, "").replace(/^(dated|preached|delivered)\b|[\s.,;:]/gi, "") === ""
}

const YEARS_RE = /^\(?\s*(?:c\.?\s*)?\d{4}\s*[-–—]\s*\d{4}\s*\)?\.?$/
const COPYRIGHT_RE = /copyright|all rights reserved|©/i

/**
 * Converte um texto legado em MDX. Nunca lança: problemas viram `warnings`/`error`.
 */
export function convertLegacy(raw: string, options: ConvertOptions): ConvertResult {
  const warnings: string[] = []
  const text = raw
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[​﻿]/g, "")
    .replace(/\t/g, " ")
    // Palavras coladas pelo HTML: "LeavesFebruary 21st, 1864byC. H. SPURGEON"
    .replace(new RegExp(`([a-z*_])(?=(?:${MONTHS.map((m) => m[0]!.toUpperCase() + m.slice(1)).join("|")})\\s+\\d)`, "g"), "$1 ")
    .replace(/([a-z0-9)])by(?=[A-Z])/g, "$1 by ")

  // Cabeçalho: "# Título", "Fonte: URL", "---"
  const header = /^#\s+(.+?)\s*\n+(?:Fonte:\s*(\S+)\s*\n+)?---[ \t]*\n/.exec(text)
  let title = options.file.replace(/\.md$/, "")
  let source: string | undefined
  let body = text
  if (header) {
    title = header[1]!
    source = header[2]
    body = text.slice(header[0].length)
  } else {
    warnings.push("Cabeçalho (título/Fonte) não encontrado: título tirado do nome do arquivo.")
  }
  title = cleanTitle(title, options.author)

  // Cabeçalhos curtos ("Immutability [02]"): o título completo costuma ser a 1ª linha do texto
  const firstLine = body
    .split("\n")
    .map((l) => plain(l).replace(new RegExp(`\\s*\\b(${MONTH_RE})\\s+\\d.*$`, "i"), ""))
    .find(Boolean)
  if (firstLine && firstLine.length <= 120) {
    const candidate = cleanTitle(firstLine, options.author)
    if (candidate && loose(candidate) !== loose(title) && loose(candidate).includes(loose(title))) title = candidate
  }

  // Linhas → blocos (separados por linha em branco)
  const blocks = splitBlocks(body)

  // Bloco de autoria no início: título repetido, by, nome, anos, data, copyright
  const authorNames = options.author.aliases.map(loose)
  const titleLoose = loose(title)
  let date: string | undefined
  let credits: string | undefined
  let removedTitle = false
  const preambleEnd = findPreambleEnd(blocks)

  const byAuthor = options.author.aliases.map(
    (a) => new RegExp(`,?\\s*\\bby\\s+${a.replace(/[.]/g, "").split(/\s+/).join("\\.?\\s*")}\\.?\\s*$`, "i"),
  )

  for (let b = 0; b < preambleEnd; b++) {
    const block = blocks[b]!
    const headingMark = /^(#{1,6})\s+/.exec(block[0] ?? "")?.[1]
    // Partes "coladas" pelo HTML (ex.: "(1703-1758)**Dated September 1733.") são analisadas separadas
    const lines = block.flatMap((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .split(/\*+|(?<=[a-z])(?=by$)/)
        .map((part) => part.trim())
        .filter(Boolean),
    )
    const kept: string[] = []
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]!
      for (const re of byAuthor) line = line.replace(re, "")
      const p = plain(line)
      const lp = loose(p)
      if (!lp) continue

      // Título repetido, possivelmente quebrado em várias linhas
      if (!removedTitle && titleLoose.startsWith(lp)) {
        let acc = lp
        let j = i
        while (acc !== titleLoose && j + 1 < lines.length && titleLoose.startsWith(acc + loose(plain(lines[j + 1]!)))) {
          j++
          acc += loose(plain(lines[j]!))
        }
        if (acc === titleLoose || acc.length >= 12) {
          removedTitle = true
          i = j
          continue
        }
      }
      if (/^(by|of)$/i.test(p)) continue
      if (authorNames.some((n) => lp === n || lp === `by${n}`)) continue
      if (YEARS_RE.test(p)) continue
      if (authorNames.some((n) => lp.startsWith(n) && YEARS_RE.test(p.slice(p.search(/\(|\d/))))) continue

      // Copyright: pode ocupar várias linhas ("This updated ... is / copyrighted © 2000 ... All rights / reserved.")
      if (COPYRIGHT_RE.test(p) || /^this (updated|revised|edited|modernized)\b/i.test(p)) {
        const parts = [p]
        let j = i
        while (j + 1 < lines.length && !/reserved\.?\s*$/i.test(parts.join(" ")) && parts.length < 6) {
          j++
          parts.push(plain(lines[j]!))
        }
        const notice = parts.join(" ").replace(/\s+/g, " ").replace(/copyrighted ã/i, "copyrighted ©").trim()
        if (COPYRIGHT_RE.test(notice)) {
          credits = credits ? `${credits} ${notice}` : notice
          i = j
          continue
        }
      }

      const d = findDate(line)
      if (d) {
        date ??= d.date
        if (d.whole) continue
      }
      kept.push(line)
    }
    blocks[b] = headingMark ? (kept.length ? [`${headingMark} ${kept.join(" ")}`] : []) : kept
  }

  if (/<\/?(html|head|meta|title|body|p|div|span|font|br|b|i|em|strong|a)\b/i.test(body)) {
    warnings.push("O texto contém marcação HTML bruta (provável sobra da página original).")
  }
  if (credits) warnings.push(`Aviso de direitos autorais encontrado: "${credits}". Confirme se o texto pode ser publicado.`)
  if (!date) warnings.push("Data não encontrada.")

  // Monta o corpo em MDX
  const out: string[] = []
  for (const lines of blocks) {
    if (lines.length === 0) continue
    out.push(...renderBlock(lines))
  }

  const bodyMdx = out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()
  const frontmatter: Record<string, string> = { title, author: options.author.slug, type: options.type }
  if (date) frontmatter.date = date
  if (source) frontmatter.source = source
  if (credits) frontmatter.credits = credits
  const mdx = `---\n${stringify(frontmatter, { lineWidth: 0 }).trimEnd()}\n---\n\n${bodyMdx}\n`

  const result: ConvertResult = {
    mdx,
    title,
    slug: slugify(title) || slugify(options.file.replace(/\.md$/, "")),
    date,
    source,
    credits,
    warnings,
    valid: false,
    segmentCount: 0,
  }

  try {
    const parsed = parseMdx(mdx)
    result.segmentCount = parsed.segments.length
    result.valid = parsed.metadata !== null && parsed.segments.length > 0
    if (!parsed.metadata) result.error = parsed.frontmatterIssues.map((i) => i.message).join("; ")
    else if (parsed.segments.length === 0) result.error = "Nenhum segmento traduzível."
  } catch (error) {
    result.error = error instanceof MdxSyntaxError ? error.message : String(error)
  }
  return result
}

function cleanTitle(raw: string, author: LegacyAuthor): string {
  let title = plain(raw).replace(/\s*\[\d+\]\s*$/, "")
  // "…SinceritybyC. H. SPURGEON(1834-1892)": autoria colada ao título
  for (const alias of author.aliases) {
    const name = alias.replace(/[.]/g, "").split(/\s+/).join("\\.?\\s*")
    title = title.replace(new RegExp(`\\s*\\bby\\s*${name}.*$|(?<=[a-z])by${name}.*$`, "i"), "")
  }
  // "Título - Autor" / "Título -- Autor"
  const m = /^(.*?)\s+[-–—]{1,2}\s+(.+)$/.exec(title)
  if (m && author.aliases.some((a) => loose(a) === loose(m[2]!))) title = m[1]!
  return titleCaseIfShouting(title.trim())
}

function splitBlocks(body: string): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim()
    if (!line) {
      if (current.length) blocks.push(current)
      current = []
      continue
    }
    // Separadores e títulos markdown sempre viram blocos próprios
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line) || /^#{1,6}\s/.test(line)) {
      if (current.length) blocks.push(current)
      blocks.push([line])
      current = []
      continue
    }
    current.push(line)
  }
  if (current.length) blocks.push(current)
  return blocks
}

/** O bloco de autoria termina no primeiro parágrafo "de verdade" (texto corrido longo). */
function findPreambleEnd(blocks: string[][]): number {
  const limit = Math.min(blocks.length, 15)
  for (let i = 0; i < limit; i++) {
    const textLength = plain(blocks[i]!.join(" ")).length
    if (textLength >= 300 && blocks[i]!.length >= 3) return i
  }
  return Math.min(limit, 6)
}

function renderBlock(lines: string[]): string[] {
  const first = lines[0]!

  if (lines.length === 1 && /^(-{3,}|\*{3,}|_{3,})$/.test(first)) return ["---"]

  // Títulos markdown: o título da obra está no frontmatter, então o corpo começa em ##
  const heading = /^(#{1,6})\s+(.*)$/.exec(first)
  if (heading && lines.length === 1) {
    const textOnly = plain(heading[2]!)
    if (!textOnly) return []
    return [`${heading[1]!.length === 1 ? "##" : heading[1]} ${escapeMdx(titleCaseIfShouting(textOnly))}`]
  }

  let paragraph = balanceEmphasis(lines.join(" ").replace(/\s+/g, " ").trim())
  const textOnly = plain(paragraph)
  if (!textOnly) return []

  // Linha curta toda em maiúsculas (ex.: "INTRODUCTION") vira seção
  if (textOnly.length <= 80 && /[A-Z]{3}/.test(textOnly) && !/[a-z]/.test(textOnly) && !/[.,;]$/.test(textOnly)) {
    return [`## ${escapeMdx(titleCaseIfShouting(textOnly))}`]
  }

  paragraph = escapeMdx(paragraph)
  // Início de linha que o markdown leria como bloco (lista, título, citação, ESM)
  paragraph = paragraph
    .replace(/^(\d+)([.)])(\s)/, "$1\\$2$3")
    .replace(/^([-+])(\s)/, "\\$1$2")
    .replace(/^#/, "\\#")
    .replace(/^>/, "\\>")
    .replace(/^(import|export)\b/, (w) => `&#${w.charCodeAt(0)};${w.slice(1)}`)
  return [paragraph]
}

/** Remove asteriscos de ênfase quando estão desbalanceados no parágrafo (sobras do HTML). */
export function balanceEmphasis(text: string): string {
  const runs = text.match(/\*+/g) ?? []
  const total = runs.reduce((n, r) => n + r.length, 0)
  const strongs = runs.reduce((n, r) => n + Math.floor(r.length / 2), 0)
  if (total % 2 === 1 || strongs % 2 === 1 || runs.length % 2 === 1) {
    return text.replace(/\*+/g, "").replace(/\s{2,}/g, " ").trim()
  }
  return text
}

/** Escapa o que o MDX leria como JSX ou expressão. */
export function escapeMdx(text: string): string {
  // Referências de caractere são literais no MDX mesmo após uma barra invertida
  return text.replace(/[{}<]/g, (c) => ({ "{": "&#123;", "}": "&#125;", "<": "&lt;" })[c]!)
}
