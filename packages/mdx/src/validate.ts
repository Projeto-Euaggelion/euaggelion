import type { Nodes, Root } from "mdast"
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx"
import { MdxSyntaxError, parseTree } from "./processor"
import { isKnownComponent, MDX_COMPONENTS, type SegmentKind } from "./schema"
import type { MdxIssue } from "./segment"

export interface ValidationResult {
  ok: boolean
  issues: MdxIssue[]
}

/** Tipos de segmento em texto puro (sem marcação MDX). */
const PLAIN_KINDS: ReadonlySet<SegmentKind> = new Set(["title", "description", "attribute"])

/**
 * Confere a tradução de um segmento contra o original: o MDX precisa ser válido, a estrutura do
 * bloco não pode mudar e a marcação inline precisa ser preservada (links, notas `[^n]`, código,
 * componentes e seus atributos não traduzíveis, ênfases).
 *
 * Usado na saída da IA e ao salvar uma edição.
 */
export function validateTranslation(sourceText: string, targetText: string, kind: SegmentKind): ValidationResult {
  const issues: MdxIssue[] = []
  const target = targetText.trim()

  if (!target) return result([{ code: "empty", message: "A tradução está vazia." }])

  if (PLAIN_KINDS.has(kind)) {
    if (kind !== "description" && target.includes("\n"))
      issues.push({ code: "line_break", message: "Este campo não aceita quebra de linha." })
    return result(issues)
  }

  let sourceTree: Root
  try {
    sourceTree = parseTree(sourceText)
  } catch {
    // Original inválido isoladamente (não deveria acontecer): não há como comparar
    return result([])
  }

  let targetTree: Root
  try {
    targetTree = parseTree(target)
  } catch (error) {
    const message = error instanceof MdxSyntaxError ? error.message : "MDX inválido."
    return result([{ code: "syntax", message: `A tradução não é MDX válido: ${message}` }])
  }

  if (blockShape(sourceTree) !== blockShape(targetTree)) {
    issues.push({
      code: "block_structure",
      message: "A tradução mudou a estrutura do bloco (ex.: começou com “-”, “#” ou “>”, ou tem linha em branco).",
    })
  }

  const source = collectMarks(sourceTree)
  const targetMarks = collectMarks(targetTree)

  for (const [category, label] of MARK_LABELS) {
    const missing = difference(source[category], targetMarks[category])
    const extra = difference(targetMarks[category], source[category])
    if (missing.length || extra.length) {
      const parts = []
      if (missing.length) parts.push(`faltando ${missing.map(quoteMark).join(", ")}`)
      if (extra.length) parts.push(`a mais ${extra.map(quoteMark).join(", ")}`)
      issues.push({ code: `mismatch_${category}`, message: `${label}: ${parts.join("; ")}.` })
    }
  }

  return result(issues)
}

function result(issues: MdxIssue[]): ValidationResult {
  return { ok: issues.length === 0, issues }
}

type MarkCategory = "links" | "footnotes" | "code" | "components" | "expressions" | "emphasis"

const MARK_LABELS: [MarkCategory, string][] = [
  ["links", "Links"],
  ["footnotes", "Notas de rodapé"],
  ["code", "Código"],
  ["components", "Componentes"],
  ["expressions", "Expressões"],
  ["emphasis", "Formatação"],
]

const EMPHASIS_LABELS: Record<string, string> = {
  emphasis: "itálico",
  strong: "negrito",
  delete: "tachado",
  break: "quebra de linha forçada",
}

function collectMarks(tree: Root): Record<MarkCategory, string[]> {
  const marks: Record<MarkCategory, string[]> = {
    links: [],
    footnotes: [],
    code: [],
    components: [],
    expressions: [],
    emphasis: [],
  }

  const walk = (node: Nodes) => {
    switch (node.type) {
      case "link":
      case "image":
        marks.links.push(node.url)
        break
      case "linkReference":
      case "imageReference":
        marks.links.push(`[${node.identifier}]`)
        break
      case "footnoteReference":
        marks.footnotes.push(`[^${node.label ?? node.identifier}]`)
        break
      case "text":
        // Isolado, o segmento não tem as definições das notas: `[^1]` chega como texto
        for (const m of node.value.matchAll(/\[\^([^\]\s]+)\]/g)) marks.footnotes.push(`[^${m[1]}]`)
        break
      case "inlineCode":
        marks.code.push(node.value)
        break
      case "mdxTextExpression":
        marks.expressions.push(`{${node.value}}`)
        break
      case "mdxJsxTextElement":
        marks.components.push(componentSignature(node))
        break
      case "emphasis":
      case "strong":
      case "delete":
      case "break":
        marks.emphasis.push(EMPHASIS_LABELS[node.type]!)
        break
    }
    if ("children" in node) for (const child of node.children) walk(child as Nodes)
  }

  walk(tree)
  return marks
}

/** Nome do componente + atributos não traduzíveis (os traduzíveis podem mudar). */
function componentSignature(node: MdxJsxTextElement): string {
  const translatable: readonly string[] = isKnownComponent(node.name)
    ? MDX_COMPONENTS[node.name].translatableAttributes
    : []
  const attrs = node.attributes
    .map((attr) => {
      if (attr.type === "mdxJsxExpressionAttribute") return `{${attr.value}}`
      if (translatable.includes(attr.name)) return attr.name
      const value =
        attr.value == null ? "" : typeof attr.value === "string" ? `="${attr.value}"` : `={${attr.value.value}}`
      return `${attr.name}${value}`
    })
    .sort()
  return `<${node.name ?? ""}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`
}

/** Estrutura dos blocos (ex.: "paragraph" ou "list>listItem>paragraph"). */
function blockShape(tree: Root): string {
  const shape = (node: Nodes): string => {
    if (!("children" in node) || node.type === "paragraph" || node.type === "heading") return node.type
    if (node.type === "mdxJsxTextElement" || isPhrasingParent(node)) return node.type
    return `${node.type}>${node.children.map((c) => shape(c as Nodes)).join(",")}`
  }
  return tree.children.map((c) => shape(c as Nodes)).join("|")
}

function isPhrasingParent(node: Nodes): boolean {
  return ["emphasis", "strong", "delete", "link", "linkReference"].includes(node.type)
}

/** Multiconjunto a − b. */
function difference(a: string[], b: string[]): string[] {
  const counts = new Map<string, number>()
  for (const item of b) counts.set(item, (counts.get(item) ?? 0) + 1)
  const out: string[] = []
  for (const item of a) {
    const n = counts.get(item) ?? 0
    if (n > 0) counts.set(item, n - 1)
    else out.push(item)
  }
  return out
}

function quoteMark(mark: string): string {
  return `“${mark}”`
}
