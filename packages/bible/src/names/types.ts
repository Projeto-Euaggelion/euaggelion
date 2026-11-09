import type { BookId } from "../books"

/** Como um livro se chama num idioma e o que o leitor pode digitar para achá-lo. */
export interface LocalizedBook {
  /** Nome do livro, ex.: `Genesis`, `Gênesis`. */
  readonly name: string
  /** Nome usado ao citar uma passagem, quando difere (`Salmos` → `Salmo 23:1`). */
  readonly referenceName?: string
  /** Forma curta (`Gn`, `Jo`). Sem ela, usa-se o id OSIS, que funciona em inglês (`Matt`, `Rev`). */
  readonly abbreviation?: string
  /** Grafias extras aceitas na busca; são normalizadas (minúsculas, sem espaços nem acentos). */
  readonly aliases: readonly string[]
}

export type BookNames = Readonly<Record<BookId, LocalizedBook>>
