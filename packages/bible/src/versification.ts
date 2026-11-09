import { BOOKS, type Book, type BookId } from "./books"
import { KJV_CHAPTER_VERSE_COUNTS } from "./kjv-versification"

/** Um versículo: livro, capítulo e versículo (a partir de 1). */
export interface VerseRef {
  readonly book: BookId
  readonly chapter: number
  readonly verse: number
}

/**
 * Posição de um versículo na ordem canônica, a partir de 0 (Gn 1:1 = 0, Ap 22:21 = 31.101 na KJV).
 * Índices densos cabem em arrays tipados e preservam a ordem: um intervalo é só `[início, fim]`.
 */
export type VerseIndex = number

/** Intervalo inclusivo de índices. */
export interface VerseIndexRange {
  readonly start: VerseIndex
  readonly end: VerseIndex
}

export type VersificationId = "kjv"

/**
 * Esquema de versificação: como os livros se dividem em capítulos e versículos. Converte
 * referências em índices densos e vice-versa, tudo em O(1).
 * Portado de trekhleb/bible-cross-references (MIT; ver LICENSE-THIRD-PARTY.md).
 */
export class Versification {
  readonly id: VersificationId
  readonly verseCount: number
  readonly chapterCount: number

  readonly #chapterVerseCounts: Readonly<Record<BookId, readonly number[]>>
  /** Para cada livro: o índice em que começa cada capítulo. */
  readonly #chapterStarts = new Map<BookId, VerseIndex[]>()
  readonly #bookRanges = new Map<BookId, VerseIndexRange>()
  /** Para cada índice: livro (ordinal), capítulo e versículo. Cabem num byte (máx. 150 e 176). */
  readonly #verseBooks: Uint8Array
  readonly #verseChapters: Uint8Array
  readonly #verseNumbers: Uint8Array

  constructor(id: VersificationId, chapterVerseCounts: Readonly<Record<BookId, readonly number[]>>) {
    this.id = id
    this.#chapterVerseCounts = chapterVerseCounts

    let verseCount = 0
    let chapterCount = 0
    for (const book of BOOKS) {
      const counts = chapterVerseCounts[book.id]
      if (!counts?.length || counts.some((count) => !Number.isInteger(count) || count < 1)) {
        throw new RangeError(`Versificação "${id}": contagem de versículos inválida em ${book.id}.`)
      }
      const starts: VerseIndex[] = []
      const bookStart = verseCount
      for (const count of counts) {
        starts.push(verseCount)
        verseCount += count
      }
      this.#chapterStarts.set(book.id, starts)
      this.#bookRanges.set(book.id, { start: bookStart, end: verseCount - 1 })
      chapterCount += counts.length
    }
    this.verseCount = verseCount
    this.chapterCount = chapterCount

    this.#verseBooks = new Uint8Array(verseCount)
    this.#verseChapters = new Uint8Array(verseCount)
    this.#verseNumbers = new Uint8Array(verseCount)
    let index = 0
    for (const book of BOOKS) {
      chapterVerseCounts[book.id].forEach((count, chapterOffset) => {
        for (let verse = 1; verse <= count; verse += 1) {
          this.#verseBooks[index] = book.ordinal
          this.#verseChapters[index] = chapterOffset + 1
          this.#verseNumbers[index] = verse
          index += 1
        }
      })
    }
  }

  chapterCountOf(book: BookId): number {
    return this.#chapterVerseCounts[book].length
  }

  /** Versículos do capítulo, ou `undefined` se o livro não tem esse capítulo. */
  verseCountOf(book: BookId, chapter: number): number | undefined {
    if (!Number.isInteger(chapter) || chapter < 1) return undefined
    return this.#chapterVerseCounts[book][chapter - 1]
  }

  /** Índice do versículo, ou `undefined` se ele não existe nesta versificação. */
  indexOf(ref: VerseRef): VerseIndex | undefined {
    const verses = this.verseCountOf(ref.book, ref.chapter)
    if (verses === undefined || !Number.isInteger(ref.verse) || ref.verse < 1 || ref.verse > verses) return undefined
    return this.#starts(ref.book)[ref.chapter - 1]! + ref.verse - 1
  }

  /** Referência do versículo no índice. Lança erro fora do intervalo. */
  refAt(index: VerseIndex): VerseRef {
    return { book: this.bookAt(index).id, chapter: this.#verseChapters[index]!, verse: this.#verseNumbers[index]! }
  }

  /** Livro que contém o versículo no índice. Lança erro fora do intervalo. */
  bookAt(index: VerseIndex): Book {
    if (!this.isValidIndex(index)) throw new RangeError(`Índice de versículo fora do intervalo: ${index}`)
    return BOOKS[this.#verseBooks[index]!]!
  }

  /** Intervalo de índices do capítulo, ou `undefined` se ele não existe. */
  chapterRange(book: BookId, chapter: number): VerseIndexRange | undefined {
    const verses = this.verseCountOf(book, chapter)
    if (verses === undefined) return undefined
    const start = this.#starts(book)[chapter - 1]!
    return { start, end: start + verses - 1 }
  }

  /** Intervalo de índices do livro inteiro. */
  bookRange(book: BookId): VerseIndexRange {
    const range = this.#bookRanges.get(book)
    if (!range) throw new RangeError(`Livro desconhecido: ${book}`)
    return range
  }

  isValidIndex(index: number): index is VerseIndex {
    return Number.isInteger(index) && index >= 0 && index < this.verseCount
  }

  #starts(book: BookId): readonly VerseIndex[] {
    const starts = this.#chapterStarts.get(book)
    if (!starts) throw new RangeError(`Livro desconhecido: ${book}`)
    return starts
  }
}

export const KJV_VERSIFICATION = new Versification("kjv", KJV_CHAPTER_VERSE_COUNTS)

/**
 * A versificação canônica do Euaggelion. Referências cruzadas, URLs e dados guardados usam esta
 * numeração, independentemente da tradução exibida.
 */
export const CANONICAL_VERSIFICATION = KJV_VERSIFICATION
