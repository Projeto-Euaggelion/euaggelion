/**
 * @euaggelion/bible
 *
 * Núcleo bíblico compartilhado pelos apps do Euaggelion (leitor, Luther, comentário, dicionário):
 * - os 66 livros com ids OSIS e os 10 gêneros;
 * - a versificação canônica (KJV: 1.189 capítulos, 31.102 versículos) e índices densos de versículos;
 * - nomes dos livros em pt-BR e inglês, busca tolerante a acentos (`Jo` = João, `Jó` = Jó);
 * - leitura, formatação e tradução de referências, com intervalos, e o formato OSIS.
 *
 * Sem dependências e sem acesso a dados: funciona no servidor e no client.
 * Partes portadas de trekhleb/bible-cross-references (MIT; ver LICENSE-THIRD-PARTY.md).
 */
export { BOOKS, BOOK_IDS, getBook, isBookId, type Book, type BookId, type Testament } from "./books"
export { GENRES, getBookGenre, getGenre, getGenreBooks, type Genre, type GenreId } from "./genres"
export {
  CANONICAL_VERSIFICATION,
  KJV_VERSIFICATION,
  Versification,
  type VerseIndex,
  type VerseIndexRange,
  type VerseRef,
  type VersificationId,
} from "./versification"
export { BOOK_NAMES, enBooks, ptBooks, type BookNames, type BookNamesLocale, type LocalizedBook } from "./names"
export {
  bookNameCollisions,
  contestedSpellings,
  foldBookName,
  lookupBook,
  normalizeBookName,
  type BookLookupResult,
} from "./book-lookup"
export {
  bookName,
  formatReference,
  localizeReference,
  parseOsis,
  parseOsisRange,
  parseReference,
  referenceFromRange,
  referenceRange,
  toOsis,
  toOsisId,
  type BibleReference,
  type FormatOptions,
  type ReferenceParseError,
  type ReferenceParseResult,
} from "./reference"
