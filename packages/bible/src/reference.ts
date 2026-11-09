import { lookupBook } from "./book-lookup"
import { isBookId, type BookId } from "./books"
import { enBooks } from "./names/en"
import type { BookNames } from "./names/types"
import { CANONICAL_VERSIFICATION, type VerseIndexRange, type VerseRef, type Versification } from "./versification"

/**
 * Uma referência bíblica dentro de um livro: capítulo inteiro, versículo, ou intervalo
 * (`Salmos 23–24`, `João 3:16–18`, `Gênesis 1:31–2:3`).
 *
 * - sem `verse`: capítulo(s) inteiro(s); `end.chapter` fecha um intervalo de capítulos;
 * - com `verse`: versículo; `end` fecha um intervalo (mesmo capítulo ou outro).
 */
export interface BibleReference {
  readonly book: BookId
  readonly chapter: number
  readonly verse?: number
  readonly end?: { readonly chapter: number; readonly verse?: number }
}

/** Por que uma referência não foi lida. São dados, não frases: o texto fica com a interface. */
export type ReferenceParseError =
  | { readonly kind: "unreadable" }
  | { readonly kind: "unknown-book"; readonly query: string }
  | { readonly kind: "ambiguous-book"; readonly query: string; readonly candidates: readonly BookId[] }
  | { readonly kind: "no-such-chapter"; readonly book: BookId; readonly chapter: number; readonly chapters: number }
  | {
      readonly kind: "no-such-verse"
      readonly book: BookId
      readonly chapter: number
      readonly verse: number
      readonly verses: number
    }
  | { readonly kind: "invalid-range" }

export type ReferenceParseResult =
  | { readonly ok: true; readonly reference: BibleReference }
  | { readonly ok: false; readonly error: ReferenceParseError }

/**
 * `<livro> <capítulo>[<sep><versículo>][<traço>[<capítulo><sep>]<versículo ou capítulo>]`
 *
 * - livro: letras de qualquer alfabeto (`Gênesis`, `João`), com número inicial (`1 Co`, `1º Coríntios`,
 *   `II Reis`), acentos combinados, apóstrofos e hífens;
 * - separador entre capítulo e versículo: `:`, `.`, `,` (estilo europeu) ou espaço (`jn 3 16`);
 * - intervalo: `-`, `–` ou `—` (`João 3:16-18`, `Gn 1:31-2:3`, `Sl 23-24`).
 *
 * O padrão do livro e do capítulo vem de trekhleb/bible-cross-references (MIT); os intervalos são
 * do Euaggelion, porque sermões e comentários citam trechos, não só versículos.
 */
const REFERENCE_PATTERN =
  /^(?<book>(?:[1-3][º°ª]?[\s.-]*)?[\p{L}\p{M}][\p{L}\p{M}\s.'’‘ʼ-]*?)\s*(?<chapter>\d+)(?:\s*[:.,\s]\s*(?<verse>\d+))?(?:\s*[-–—]\s*(?:(?<endChapter>\d+)\s*[:.,]\s*)?(?<end>\d+))?$/iu

function failure(error: ReferenceParseError): ReferenceParseResult {
  return { ok: false, error }
}

/**
 * Lê uma referência digitada (`João 3:16`, `jo 3 16`, `1co13`, `Gn 1:31-2:3`, `Psalm 23`) num
 * idioma e confere que capítulos e versículos existem na versificação (KJV por padrão).
 */
export function parseReference(
  input: string,
  names: BookNames = enBooks,
  versification: Versification = CANONICAL_VERSIFICATION,
): ReferenceParseResult {
  const groups = REFERENCE_PATTERN.exec(input.trim())?.groups
  if (!groups) return failure({ kind: "unreadable" })
  const { book: bookQuery = "", chapter: chapterText = "", verse: verseText, endChapter: endChapterText, end: endText } = groups

  const lookup = lookupBook(bookQuery, names)
  if (lookup.kind === "unknown") return failure({ kind: "unknown-book", query: bookQuery.trim() })
  if (lookup.kind === "ambiguous") {
    return failure({ kind: "ambiguous-book", query: bookQuery.trim(), candidates: lookup.candidates.map((b) => b.id) })
  }
  const book = lookup.book.id

  const checkChapter = (chapter: number): ReferenceParseError | null =>
    versification.verseCountOf(book, chapter) === undefined
      ? { kind: "no-such-chapter", book, chapter, chapters: versification.chapterCountOf(book) }
      : null
  const checkVerse = (chapter: number, verse: number): ReferenceParseError | null => {
    const verses = versification.verseCountOf(book, chapter)!
    return verse < 1 || verse > verses ? { kind: "no-such-verse", book, chapter, verse, verses } : null
  }

  const chapter = Number(chapterText)
  const chapterError = checkChapter(chapter)
  if (chapterError) return failure(chapterError)

  // Capítulo(s) inteiro(s)
  if (verseText === undefined) {
    if (endText === undefined) return { ok: true, reference: { book, chapter } }
    if (endChapterText !== undefined) return failure({ kind: "invalid-range" })
    const endChapter = Number(endText)
    const endError = checkChapter(endChapter)
    if (endError) return failure(endError)
    if (endChapter < chapter) return failure({ kind: "invalid-range" })
    return { ok: true, reference: normalize({ book, chapter, end: { chapter: endChapter } }) }
  }

  const verse = Number(verseText)
  const verseError = checkVerse(chapter, verse)
  if (verseError) return failure(verseError)
  if (endText === undefined) return { ok: true, reference: { book, chapter, verse } }

  const endChapter = endChapterText === undefined ? chapter : Number(endChapterText)
  const endChapterError = checkChapter(endChapter)
  if (endChapterError) return failure(endChapterError)
  const endVerse = Number(endText)
  const endVerseError = checkVerse(endChapter, endVerse)
  if (endVerseError) return failure(endVerseError)
  if (endChapter < chapter || (endChapter === chapter && endVerse < verse)) return failure({ kind: "invalid-range" })
  return { ok: true, reference: normalize({ book, chapter, verse, end: { chapter: endChapter, verse: endVerse } }) }
}

/** Remove um `end` igual ao início (`João 3:16-16` → `João 3:16`). */
function normalize(reference: BibleReference): BibleReference {
  const { end, ...start } = reference
  if (!end || (end.chapter === start.chapter && end.verse === start.verse)) return start
  return reference
}

export interface FormatOptions {
  /** Usa a abreviação do livro (`Jo 3:16`, `Sl 23`). */
  readonly abbreviated?: boolean
}

/**
 * Formata para exibição: `João 3:16`, `João 3:16–18`, `Gênesis 1:31–2:3`, `Salmo 23`, `Salmos 23–24`.
 * Uma só passagem usa o nome de citação (`Salmo`); um intervalo de capítulos, o nome do livro.
 */
export function formatReference(reference: BibleReference, names: BookNames, options: FormatOptions = {}): string {
  const localized = names[reference.book]
  const chapterRange = reference.verse === undefined && reference.end !== undefined
  const bookName = options.abbreviated
    ? (localized.abbreviation ?? reference.book)
    : chapterRange
      ? localized.name
      : (localized.referenceName ?? localized.name)

  const { chapter, verse, end } = reference
  if (verse === undefined) return end ? `${bookName} ${chapter}–${end.chapter}` : `${bookName} ${chapter}`
  if (!end) return `${bookName} ${chapter}:${verse}`
  if (end.chapter === chapter) return `${bookName} ${chapter}:${verse}–${end.verse}`
  return `${bookName} ${chapter}:${verse}–${end.chapter}:${end.verse}`
}

/** Nome do livro num idioma (`Salmos`, `Psalms`). */
export function bookName(book: BookId, names: BookNames): string {
  return names[book].name
}

/**
 * Traduz uma referência de um idioma para outro (`John 3:16-18` → `João 3:16–18`). Útil para o
 * `ref` de `<Scripture>`: o original em inglês é lido em `en` e exibido em pt-BR. `null` se a
 * referência não for válida no idioma de origem.
 */
export function localizeReference(input: string, from: BookNames, to: BookNames, options?: FormatOptions): string | null {
  const parsed = parseReference(input, from)
  return parsed.ok ? formatReference(parsed.reference, to, options) : null
}

/** Intervalo de índices coberto pela referência. Lança erro se ela não existe na versificação. */
export function referenceRange(reference: BibleReference, versification: Versification = CANONICAL_VERSIFICATION): VerseIndexRange {
  const { book, chapter, verse, end } = reference
  const missing = () => new RangeError(`Referência inexistente: ${toOsis(reference)}`)
  if (verse === undefined) {
    const first = versification.chapterRange(book, chapter)
    const last = versification.chapterRange(book, end?.chapter ?? chapter)
    if (!first || !last) throw missing()
    return { start: first.start, end: last.end }
  }
  const start = versification.indexOf({ book, chapter, verse })
  const stop = end ? versification.indexOf({ book, chapter: end.chapter, verse: end.verse ?? verse }) : start
  if (start === undefined || stop === undefined) throw missing()
  return { start, end: stop }
}

/**
 * A referência (em versículos) de um intervalo de índices no mesmo livro, ou `undefined` se o
 * intervalo atravessa livros. Ex.: o destino de uma referência cruzada.
 */
export function referenceFromRange(
  range: VerseIndexRange,
  versification: Versification = CANONICAL_VERSIFICATION,
): BibleReference | undefined {
  const start = versification.refAt(range.start)
  const end = versification.refAt(range.end)
  if (start.book !== end.book) return undefined
  return normalize({ book: start.book, chapter: start.chapter, verse: start.verse, end: { chapter: end.chapter, verse: end.verse } })
}

// ---------------------------------------------------------------------------------------------
// OSIS: `Gen.1.1`, `Ps.23`, `Rom.1.19-Rom.1.20` (formato das referências cruzadas do OpenBible)
// ---------------------------------------------------------------------------------------------

const OSIS_POINT = /^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/

/** Um versículo em OSIS (`Gen.1.1`). */
export function toOsisId(ref: VerseRef): string {
  return `${ref.book}.${ref.chapter}.${ref.verse}`
}

/** A referência em OSIS: `John.3.16`, `John.3.16-John.3.18`, `Ps.23`, `Ps.23-Ps.24`. */
export function toOsis(reference: BibleReference): string {
  const { book, chapter, verse, end } = reference
  const start = verse === undefined ? `${book}.${chapter}` : `${book}.${chapter}.${verse}`
  if (!end) return start
  return verse === undefined ? `${start}-${book}.${end.chapter}` : `${start}-${book}.${end.chapter}.${end.verse}`
}

function parseOsisPoint(text: string): { book: BookId; chapter: number; verse?: number } | undefined {
  const match = OSIS_POINT.exec(text)
  if (!match || !isBookId(match[1]!)) return undefined
  return { book: match[1], chapter: Number(match[2]), ...(match[3] ? { verse: Number(match[3]) } : {}) }
}

/**
 * Lê uma referência OSIS e confere que existe. Intervalos entre livros diferentes não cabem numa
 * `BibleReference`; para eles, use `parseOsisRange`.
 */
export function parseOsis(osis: string, versification: Versification = CANONICAL_VERSIFICATION): BibleReference | undefined {
  const [startText = "", endText, extra] = osis.trim().split("-")
  if (extra !== undefined) return undefined
  const start = parseOsisPoint(startText)
  const end = endText === undefined ? undefined : parseOsisPoint(endText)
  if (!start || (endText !== undefined && !end)) return undefined
  if (end && (end.book !== start.book || (end.verse === undefined) !== (start.verse === undefined))) return undefined

  const reference = normalize({
    book: start.book,
    chapter: start.chapter,
    ...(start.verse === undefined ? {} : { verse: start.verse }),
    ...(end ? { end: { chapter: end.chapter, ...(end.verse === undefined ? {} : { verse: end.verse }) } } : {}),
  })
  try {
    const range = referenceRange(reference, versification)
    return range.end >= range.start ? reference : undefined
  } catch {
    return undefined
  }
}

/** Intervalo de índices de uma referência OSIS, inclusive entre livros (`Gen.50.26-Exod.1.1`). */
export function parseOsisRange(osis: string, versification: Versification = CANONICAL_VERSIFICATION): VerseIndexRange | undefined {
  const [startText = "", endText, extra] = osis.trim().split("-")
  if (extra !== undefined) return undefined
  const start = parseOsisPoint(startText)
  const end = endText === undefined ? start : parseOsisPoint(endText)
  if (!start || !end) return undefined
  const first =
    start.verse === undefined ? versification.chapterRange(start.book, start.chapter)?.start : versification.indexOf({ ...start, verse: start.verse })
  const last = end.verse === undefined ? versification.chapterRange(end.book, end.chapter)?.end : versification.indexOf({ ...end, verse: end.verse })
  if (first === undefined || last === undefined || last < first) return undefined
  return { start: first, end: last }
}
