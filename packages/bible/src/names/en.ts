import { BOOKS, type BookId } from "../books"
import type { BookNames, LocalizedBook } from "./types"

/** Os livros em inglês, tirados do próprio cânon (`BOOKS`), onde também estão os ids OSIS. */
export const enBooks: BookNames = Object.fromEntries(
  BOOKS.map((book): readonly [BookId, LocalizedBook] => [
    book.id,
    {
      name: book.name,
      ...(book.referenceName === undefined ? {} : { referenceName: book.referenceName }),
      aliases: book.aliases,
    },
  ]),
) as BookNames
