import { isMap } from "yaml"
import { locateSegments, type LocatedSegment } from "./segment"

export interface ReconstructOptions {
  /**
   * Permite segmentos sem tradução (mantêm o texto original). Útil na pré-visualização;
   * na publicação todos os segmentos precisam estar traduzidos.
   */
  allowMissing?: boolean
  /** Campos extras ou substituídos no frontmatter da tradução (ex.: `language`, `translation`). */
  frontmatter?: Record<string, unknown>
}

export class ReconstructError extends Error {
  readonly paths: string[]

  constructor(message: string, paths: string[] = []) {
    super(paths.length ? `${message}: ${paths.join(", ")}` : message)
    this.name = "ReconstructError"
    this.paths = paths
  }
}

/**
 * Reconstrói o MDX traduzido a partir do original e das traduções (chaveadas por `ast_path`).
 *
 * Só o conteúdo dos segmentos é substituído. O resto (imports, código, atributos não
 * traduzíveis, marcadores de bloco, espaçamento) é preservado byte a byte.
 */
export function reconstructMdx(
  sourceMdx: string,
  translations: Readonly<Record<string, string>> | ReadonlyMap<string, string>,
  options: ReconstructOptions = {},
): string {
  const map = translations instanceof Map ? translations : new Map(Object.entries(translations))
  const doc = locateSegments(sourceMdx)
  const byPath = new Map(doc.segments.map((s) => [s.ast_path, s]))

  const unknown = [...map.keys()].filter((path) => !byPath.has(path))
  if (unknown.length) throw new ReconstructError("Segmentos inexistentes no original", unknown)

  if (!options.allowMissing) {
    const missing = doc.segments.filter((s) => !map.get(s.ast_path)?.trim()).map((s) => s.ast_path)
    if (missing.length) throw new ReconstructError("Segmentos sem tradução", missing)
  }

  const edits: { start: number; end: number; text: string }[] = []

  for (const seg of doc.segments) {
    if (seg.frontmatterKey) continue
    const translated = map.get(seg.ast_path)
    if (translated === undefined || !translated.trim() || translated === seg.text) continue
    edits.push({ start: seg.start, end: seg.end, text: renderSegment(seg, translated) })
  }

  // Frontmatter: valores traduzidos + campos extras, editando o YAML (preserva o restante)
  const frontmatterEdits = doc.segments.filter((s) => s.frontmatterKey && map.get(s.ast_path)?.trim())
  if (doc.yaml && (frontmatterEdits.length || options.frontmatter)) {
    const yamlDoc = doc.yaml.doc.clone()
    if (!isMap(yamlDoc.contents)) throw new ReconstructError("Frontmatter não é um objeto YAML")
    for (const seg of frontmatterEdits) yamlDoc.set(seg.frontmatterKey!, map.get(seg.ast_path)!.trim())
    for (const [key, value] of Object.entries(options.frontmatter ?? {})) yamlDoc.set(key, value)
    edits.push({ start: doc.yaml.start, end: doc.yaml.end, text: `---\n${yamlDoc.toString().trimEnd()}\n---` })
  } else if (!doc.yaml && options.frontmatter) {
    throw new ReconstructError("O original não tem frontmatter")
  }

  let output = doc.source
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end)
  }

  // O resultado precisa continuar sendo MDX válido com os mesmos segmentos
  const check = locateSegments(output)
  const expected = doc.segments.map((s) => s.ast_path).join("|")
  const actual = check.segments.map((s) => s.ast_path).join("|")
  if (expected !== actual) {
    const changed = doc.segments
      .filter((s, i) => check.segments[i]?.ast_path !== s.ast_path)
      .map((s) => s.ast_path)
    throw new ReconstructError("A tradução alterou a estrutura do documento", changed.slice(0, 1))
  }
  return output
}

function renderSegment(seg: LocatedSegment, translated: string): string {
  const text = translated.trim()
  if (seg.kind === "attribute") {
    const escaped = seg.quote === "'" ? "&apos;" : "&quot;"
    return text.replace(/\s*\n\s*/g, " ").replaceAll(seg.quote ?? '"', escaped)
  }
  if (seg.singleLine) return text.replace(/\s*\n\s*/g, " ")
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : seg.linePrefix + line))
    .join("\n")
}
