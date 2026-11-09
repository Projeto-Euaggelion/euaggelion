import { enBooks } from "./en"
import { ptBooks } from "./pt"
import type { BookNames } from "./types"

export type { BookNames, LocalizedBook } from "./types"
export { enBooks, ptBooks }

/** Idiomas com nomes de livros. `pt-BR` é o da interface do Euaggelion; `en`, o dos originais. */
export type BookNamesLocale = "pt-BR" | "en"

export const BOOK_NAMES: Readonly<Record<BookNamesLocale, BookNames>> = {
  "pt-BR": ptBooks,
  en: enBooks,
}
