import { BOOKS, type Book } from "./books"
import type { BookNames } from "./names/types"

/*
 * Busca de livros por nome, abreviação ou id OSIS, num idioma.
 * Portado de trekhleb/bible-cross-references (MIT; ver LICENSE-THIRD-PARTY.md).
 */

export type BookLookupResult =
  | { readonly kind: "found"; readonly book: Book }
  | { readonly kind: "ambiguous"; readonly candidates: readonly Book[] }
  | { readonly kind: "unknown" }

/** Letras sem acento a remover, que a decomposição Unicode não simplifica sozinha. */
const FOLDED_LETTERS: readonly (readonly [RegExp, string])[] = [
  [/ı/g, "i"],
  [/ß/g, "ss"],
  [/ø/g, "o"],
  [/ł/g, "l"],
  [/đ/g, "d"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
]

/**
 * Normaliza um nome de livro para a busca: NFC, minúsculas, numeral romano inicial vira dígito
 * ("II Reis" → "2reis") e some a pontuação que só separa partes do nome (espaços, pontos, hífens,
 * apóstrofos e o ordinal "º" de "1º Coríntios"). Os acentos ficam.
 *
 * O NFC importa: o mesmo "ó" pode chegar como um caractere ou como "o" + acento combinado (texto
 * colado de PDF ou do macOS); os dois precisam cair na mesma chave.
 */
export function normalizeBookName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/^(i{1,3})\s+/, (_match: string, numeral: string) => String(numeral.length))
    .replace(/[\s.\-'’‘ʼº°ª]+/gu, "")
}

/**
 * O mesmo, sem acentos, que é como se digita no celular (`genesis`, `josue`). É uma segunda
 * passada, não a única: em português o acento é a diferença entre `Jó` e `Jo` (João).
 */
export function foldBookName(value: string): string {
  let folded = normalizeBookName(value)
  for (const [pattern, replacement] of FOLDED_LETTERS) folded = folded.replace(pattern, replacement)
  return folded.normalize("NFD").replace(/\p{M}+/gu, "")
}

interface BookIndex {
  /** Pela grafia digitada, com acentos. */
  readonly exact: ReadonlyMap<string, Book>
  /** Pela grafia sem acentos; uma chave que dois livros dividem é descartada, não adivinhada. */
  readonly folded: ReadonlyMap<string, Book>
  /** Grafias que, sem acento, servem a dois livros (precisam ser digitadas com o acento). */
  readonly contested: readonly string[]
  readonly byName: readonly { readonly book: Book; readonly names: readonly string[] }[]
  /** Grafias que dois livros reivindicam. Sempre vazio num catálogo correto (há teste). */
  readonly collisions: readonly string[]
}

function namesOf(book: Book, names: BookNames): string[] {
  const localized = names[book.id]
  return [localized.name, localized.referenceName ?? localized.name]
}

function buildIndex(names: BookNames): BookIndex {
  const exact = new Map<string, Book>()
  const folded = new Map<string, Book>()
  const contested = new Set<string>()
  const collisions = new Set<string>()
  for (const book of BOOKS) {
    const spellings = [book.id, ...namesOf(book, names), names[book.id].abbreviation ?? book.id, ...names[book.id].aliases]
    for (const spelling of spellings) {
      const key = normalizeBookName(spelling)
      const existing = exact.get(key)
      if (existing && existing !== book) {
        // Não lança: isto roda em buscas digitadas pelo usuário. O teste de colisões pega o erro no CI.
        collisions.add(`${key}: ${existing.id} e ${book.id}`)
        continue
      }
      exact.set(key, book)

      const loose = foldBookName(spelling)
      const sharing = folded.get(loose)
      if (sharing && sharing !== book) contested.add(loose)
      folded.set(loose, book)
    }
  }
  for (const key of contested) folded.delete(key)
  return {
    exact,
    folded,
    contested: [...contested].sort(),
    byName: BOOKS.map((book) => ({ book, names: namesOf(book, names).map(foldBookName) })),
    collisions: [...collisions],
  }
}

const indices = new WeakMap<BookNames, BookIndex>()

function indexFor(names: BookNames): BookIndex {
  let index = indices.get(names)
  if (!index) {
    index = buildIndex(names)
    indices.set(names, index)
  }
  return index
}

/** Grafias que dois livros reivindicam num catálogo (`"chave: A e B"`). Vazio num catálogo correto. */
export function bookNameCollisions(names: BookNames): readonly string[] {
  return indexFor(names).collisions
}

/** Grafias que, sem acento, levam a dois livros (ex.: `jo` em português: Jó e João). */
export function contestedSpellings(names: BookNames): readonly string[] {
  return indexFor(names).contested
}

/**
 * Acha um livro por nome, id OSIS ou abreviação. A grafia exata vence; senão, a consulta é tratada
 * como prefixo dos nomes completos ("gene" acha Gênesis; "jo" em inglês é ambíguo).
 */
export function lookupBook(query: string, names: BookNames): BookLookupResult {
  const key = normalizeBookName(query)
  if (key === "") return { kind: "unknown" }
  const index = indexFor(names)
  const exactMatch = index.exact.get(key) ?? index.folded.get(foldBookName(query))
  if (exactMatch) return { kind: "found", book: exactMatch }

  const loose = foldBookName(query)
  const candidates = index.byName.filter(({ names: bookNames }) => bookNames.some((name) => name.startsWith(loose))).map(({ book }) => book)
  if (candidates.length === 1) return { kind: "found", book: candidates[0]! }
  return candidates.length === 0 ? { kind: "unknown" } : { kind: "ambiguous", candidates }
}
