import type { Root } from "mdast"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMdx from "remark-mdx"
import remarkParse from "remark-parse"
import { unified } from "unified"

const processor = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).use(remarkFrontmatter, ["yaml"])

/** Erro de sintaxe MDX, com a posição (1-based) quando disponível. */
export class MdxSyntaxError extends Error {
  readonly line: number | undefined
  readonly column: number | undefined

  constructor(message: string, line?: number, column?: number) {
    super(line ? `${message} (linha ${line}${column ? `, coluna ${column}` : ""})` : message)
    this.name = "MdxSyntaxError"
    this.line = line
    this.column = column
  }
}

/** Normaliza quebras de linha e remove o BOM, para os offsets serem estáveis. */
export function normalizeSource(source: string): string {
  return source.replace(/^﻿/, "").replace(/\r\n?/g, "\n")
}

/** Faz o parse (sem transformar) de um texto já normalizado. */
export function parseTree(source: string): Root {
  try {
    return processor.parse(source)
  } catch (error) {
    const e = error as { reason?: string; message?: string; line?: number; column?: number }
    throw new MdxSyntaxError(e.reason ?? e.message ?? "MDX inválido", e.line ?? undefined, e.column ?? undefined)
  }
}
