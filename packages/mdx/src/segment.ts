import type { Nodes, Parents, PhrasingContent, Root, RootContent } from "mdast"
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx"
import { isMap, isScalar, parseDocument, type Document } from "yaml"
import { normalizeSource, parseTree } from "./processor"
import {
  frontmatterSchema,
  isKnownComponent,
  MDX_COMPONENTS,
  TRANSLATABLE_FRONTMATTER,
  type Frontmatter,
  type SegmentKind,
} from "./schema"

/** Segmento como gravado em `source_segments` (formato do RPC `create_source_version`). */
export interface SourceSegment {
  position: number
  kind: SegmentKind
  /** Conteúdo do bloco em MDX (formatação inline preservada), sem marcadores de bloco. */
  text: string
  /** Chave estável do segmento no documento, usada para reconstruir o MDX. */
  ast_path: string
}

/** Problema de validação (frontmatter ou tradução). */
export interface MdxIssue {
  code: string
  message: string
  path?: string
}

export interface ParsedMdx {
  /** Texto normalizado (LF, sem BOM). É o que deve ser gravado em `source_versions.mdx`. */
  source: string
  /** Frontmatter bruto (YAML), ou `null` se não houver. */
  frontmatter: Record<string, unknown> | null
  /** Frontmatter validado pelo schema da obra, ou `null` se houver problemas. */
  metadata: Frontmatter | null
  frontmatterIssues: MdxIssue[]
  segments: SourceSegment[]
}

/** Segmento com a localização no texto, para a reconstrução. */
export interface LocatedSegment extends SourceSegment {
  /** Intervalo [start, end) do conteúdo no texto normalizado (corpo e atributos). */
  start: number
  end: number
  /** Prefixo das linhas de continuação (`> ` de citações, recuo de listas e notas). */
  linePrefix: string
  /** Títulos, células de tabela e atributos não aceitam quebra de linha. */
  singleLine?: boolean
  /** Aspas do valor, em segmentos `attribute`. */
  quote?: '"' | "'"
  /** Segmentos do frontmatter são substituídos no YAML, não por offset. */
  frontmatterKey?: string
}

export interface LocatedDocument {
  source: string
  tree: Root
  /** Nó YAML do frontmatter e o documento já lido. */
  yaml: { start: number; end: number; doc: Document } | null
  segments: LocatedSegment[]
}

const SKIPPED = new Set([
  "yaml",
  "code",
  "html",
  "definition",
  "thematicBreak",
  "mdxjsEsm",
  "mdxFlowExpression",
  "math",
])

interface Context {
  kind: SegmentKind
  singleLine?: boolean
  linePrefix: string
  quoteDepth: number
}

/**
 * Lê um MDX, valida o frontmatter e devolve os segmentos traduzíveis na ordem do documento.
 * Lança `MdxSyntaxError` se o MDX for inválido.
 */
export function parseMdx(input: string): ParsedMdx {
  const located = locateSegments(input)
  const frontmatter = located.yaml ? yamlObject(located.yaml.doc) : null
  const frontmatterIssues: MdxIssue[] = []
  let metadata: Frontmatter | null = null

  if (located.yaml && located.yaml.doc.errors.length > 0) {
    for (const err of located.yaml.doc.errors) {
      frontmatterIssues.push({ code: "frontmatter_yaml", message: `YAML inválido: ${err.message}` })
    }
  } else if (!frontmatter) {
    frontmatterIssues.push({ code: "frontmatter_missing", message: "O MDX não tem frontmatter." })
  } else {
    const result = frontmatterSchema.safeParse(frontmatter)
    if (result.success) metadata = result.data
    else
      for (const issue of result.error.issues) {
        frontmatterIssues.push({
          code: "frontmatter_invalid",
          message: issue.message,
          path: issue.path.join("."),
        })
      }
  }

  return {
    source: located.source,
    frontmatter,
    metadata,
    frontmatterIssues,
    segments: located.segments.map(({ position, kind, text, ast_path }) => ({ position, kind, text, ast_path })),
  }
}

/** Como `parseMdx`, mas devolve também a posição de cada segmento no texto. */
export function locateSegments(input: string): LocatedDocument {
  const source = normalizeSource(input)
  const tree = parseTree(source)
  const segments: LocatedSegment[] = []

  // Frontmatter: title e description viram os primeiros segmentos
  let yaml: LocatedDocument["yaml"] = null
  const yamlNode = tree.children[0]?.type === "yaml" ? tree.children[0] : null
  if (yamlNode?.position) {
    const doc = parseDocument(yamlNode.value)
    yaml = { start: yamlNode.position.start.offset!, end: yamlNode.position.end.offset!, doc }
    if (doc.errors.length === 0 && isMap(doc.contents)) {
      for (const key of TRANSLATABLE_FRONTMATTER) {
        const node = doc.get(key, true)
        if (isScalar(node) && typeof node.value === "string" && node.value.trim()) {
          segments.push({
            position: 0,
            kind: key,
            text: node.value,
            ast_path: `frontmatter.${key}`,
            start: -1,
            end: -1,
            linePrefix: "",
            frontmatterKey: key,
          })
        }
      }
    }
  }

  const push = (seg: Omit<LocatedSegment, "position">) => segments.push({ ...seg, position: 0 })

  const visit = (node: RootContent, path: string, ctx: Context) => {
    if (SKIPPED.has(node.type)) return

    switch (node.type) {
      case "heading":
        pushPhrasing(source, node.children, path, { ...ctx, kind: "heading", singleLine: true }, push)
        return

      case "paragraph": {
        // Componente de bloco escrito numa linha só (<Note>texto</Note>) vira parágrafo com um
        // elemento JSX: o segmento é o conteúdo do componente, não a tag.
        const only = soleJsxChild(node.children)
        if (only && isKnownComponent(only.name)) {
          const elementPath = `${path}.${node.children.indexOf(only)}`
          pushAttributes(source, only, elementPath, push)
          pushPhrasing(source, only.children, elementPath, { ...ctx, kind: MDX_COMPONENTS[only.name].kind }, push)
          return
        }
        pushPhrasing(source, node.children, path, ctx, push)
        return
      }

      case "tableCell":
        pushPhrasing(source, node.children, path, { ...ctx, kind: "paragraph", singleLine: true }, push)
        return

      case "blockquote":
        return visitChildren(node, path, {
          kind: "quote",
          linePrefix: `${ctx.linePrefix}> `,
          quoteDepth: ctx.quoteDepth + 1,
        })

      case "listItem": {
        const first = node.children[0]
        const width =
          first?.position && node.position ? first.position.start.column - node.position.start.column : 2
        return visitChildren(node, path, {
          ...ctx,
          kind: "list_item",
          linePrefix: ctx.linePrefix + " ".repeat(Math.max(width, 2)),
        })
      }

      case "footnoteDefinition":
        return visitChildren(node, path, { ...ctx, kind: "footnote", linePrefix: `${ctx.linePrefix}    ` })

      case "mdxJsxFlowElement": {
        pushAttributes(source, node, path, push)
        const kind = isKnownComponent(node.name) ? MDX_COMPONENTS[node.name].kind : ctx.kind
        return visitChildren(node, path, { ...ctx, kind })
      }

      default:
        if ("children" in node) visitChildren(node as Parents, path, ctx)
    }
  }

  const visitChildren = (parent: Parents, path: string, ctx: Context) => {
    parent.children.forEach((child, i) => visit(child as RootContent, path ? `${path}.${i}` : String(i), ctx))
  }

  visitChildren(tree, "", { kind: "paragraph", linePrefix: "", quoteDepth: 0 })

  segments.forEach((seg, i) => (seg.position = i))
  return { source, tree, yaml, segments }
}

function yamlObject(doc: Document): Record<string, unknown> | null {
  const data: unknown = doc.toJS()
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null
}

function soleJsxChild(children: PhrasingContent[]): MdxJsxTextElement | null {
  const meaningful = children.filter((c) => !(c.type === "text" && !c.value.trim()))
  return meaningful.length === 1 && meaningful[0]!.type === "mdxJsxTextElement" ? meaningful[0] : null
}

/** Há texto a traduzir? (parágrafos só com imagem ou expressão são ignorados) */
function hasText(nodes: Nodes[]): boolean {
  return nodes.some((n) => {
    if (n.type === "text") return n.value.trim().length > 0
    if (n.type === "inlineCode" || n.type === "mdxTextExpression" || n.type === "image") return false
    return "children" in n && hasText(n.children as Nodes[])
  })
}

function pushPhrasing(
  source: string,
  children: PhrasingContent[],
  path: string,
  ctx: Context,
  push: (seg: Omit<LocatedSegment, "position">) => void,
) {
  if (children.length === 0 || !hasText(children)) return
  let start = children[0]!.position!.start.offset!
  let end = children[children.length - 1]!.position!.end.offset!

  // Espaços nas bordas não fazem parte do segmento
  while (start < end && /\s/.test(source[start]!)) start++
  while (end > start && /\s/.test(source[end - 1]!)) end--

  push({
    kind: ctx.kind,
    text: stripContinuation(source.slice(start, end), ctx.quoteDepth),
    ast_path: path,
    start,
    end,
    linePrefix: ctx.linePrefix,
    singleLine: ctx.singleLine,
  })
}

/** Remove os marcadores de bloco (`>`, recuo) das linhas de continuação. */
function stripContinuation(text: string, quoteDepth: number): string {
  if (!text.includes("\n")) return text
  const marker = new RegExp(`^[ \\t]*(?:>[ \\t]*){0,${quoteDepth}}`)
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : line.replace(marker, "")))
    .join("\n")
}

function pushAttributes(
  source: string,
  element: MdxJsxFlowElement | MdxJsxTextElement,
  path: string,
  push: (seg: Omit<LocatedSegment, "position">) => void,
) {
  if (!isKnownComponent(element.name)) return
  const translatable: readonly string[] = MDX_COMPONENTS[element.name].translatableAttributes
  for (const attr of element.attributes) {
    if (attr.type !== "mdxJsxAttribute" || !translatable.includes(attr.name)) continue
    const range = attributeValueRange(source, attr)
    if (!range || !source.slice(range.start, range.end).trim()) continue
    push({
      kind: "attribute",
      text: source.slice(range.start, range.end),
      ast_path: `${path}@${attr.name}`,
      start: range.start,
      end: range.end,
      linePrefix: "",
      singleLine: true,
      quote: range.quote,
    })
  }
}

/** Intervalo do valor (sem as aspas) de um atributo string: `source="…"`. */
function attributeValueRange(source: string, attr: MdxJsxAttribute) {
  if (typeof attr.value !== "string" || !attr.position) return null
  const from = attr.position.start.offset!
  const to = attr.position.end.offset!
  const raw = source.slice(from, to)
  const match = /=\s*(["'])/.exec(raw)
  if (!match) return null
  const quote = match[1] as '"' | "'"
  if (source[to - 1] !== quote) return null
  return { start: from + match.index + match[0].length, end: to - 1, quote }
}
