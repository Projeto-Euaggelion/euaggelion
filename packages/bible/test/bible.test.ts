import { describe, expect, it } from "vitest"

import {
  BOOKS,
  GENRES,
  KJV_VERSIFICATION as kjv,
  bookNameCollisions,
  contestedSpellings,
  enBooks,
  formatReference,
  getBookGenre,
  getGenreBooks,
  localizeReference,
  parseOsis,
  parseOsisRange,
  parseReference,
  ptBooks,
  referenceFromRange,
  referenceRange,
  toOsis,
  type BibleReference,
  type BookNames,
} from "../src"
import { ACCEPTANCE_EN, ACCEPTANCE_PT } from "./acceptance"

describe("livros e gêneros", () => {
  it("tem os 66 livros do cânon protestante, em ordem", () => {
    expect(BOOKS).toHaveLength(66)
    expect(BOOKS[0]!.id).toBe("Gen")
    expect(BOOKS[39]!.id).toBe("Matt")
    expect(BOOKS.filter((b) => b.testament === "OT")).toHaveLength(39)
    expect(BOOKS.every((b, i) => b.ordinal === i)).toBe(true)
  })

  it("agrupa os livros em 10 gêneros contínuos", () => {
    expect(GENRES).toHaveLength(10)
    expect(getBookGenre("Ps").id).toBe("poetry")
    expect(getBookGenre("Rom").name).toBe("Epístolas paulinas")
    const flattened = GENRES.flatMap((g) => getGenreBooks(g.id))
    expect(flattened).toEqual(BOOKS.map((b) => b.id))
  })
})

describe("versificação KJV", () => {
  it("tem as contagens padrão", () => {
    expect(kjv.chapterCount).toBe(1189)
    expect(kjv.verseCount).toBe(31102)
    expect(kjv.chapterCountOf("Ps")).toBe(150)
    expect(kjv.verseCountOf("Ps", 119)).toBe(176)
    expect(kjv.verseCountOf("Gen", 51)).toBeUndefined()
    expect(kjv.verseCountOf("Gen", 0)).toBeUndefined()
  })

  it("converte referências em índices densos, na ordem canônica", () => {
    expect(kjv.indexOf({ book: "Gen", chapter: 1, verse: 1 })).toBe(0)
    expect(kjv.indexOf({ book: "Gen", chapter: 2, verse: 1 })).toBe(31)
    expect(kjv.indexOf({ book: "Rev", chapter: 22, verse: 21 })).toBe(31101)
    expect(kjv.indexOf({ book: "Gen", chapter: 1, verse: 32 })).toBeUndefined()
    expect(kjv.indexOf({ book: "3John", chapter: 1, verse: 15 })).toBeUndefined()
  })

  it("ida e volta em todos os 31.102 índices", () => {
    for (let index = 0; index < kjv.verseCount; index += 1) {
      expect(kjv.indexOf(kjv.refAt(index))).toBe(index)
    }
  })

  it("intervalos de capítulo e de livro", () => {
    expect(kjv.chapterRange("John", 3)).toEqual({ start: 26121, end: 26156 })
    expect(kjv.indexOf({ book: "John", chapter: 3, verse: 16 })).toBe(26136) // nº 26.137 na contagem tradicional
    const matthew = kjv.bookRange("Matt")
    expect(kjv.bookAt(matthew.start - 1).id).toBe("Mal")
    expect(kjv.refAt(matthew.end)).toEqual({ book: "Matt", chapter: 28, verse: 20 })
    expect(() => kjv.refAt(31102)).toThrow(RangeError)
  })
})

describe("nomes dos livros", () => {
  it.each([
    ["en", enBooks],
    ["pt", ptBooks],
  ] as const)("nenhuma grafia é reivindicada por dois livros (%s)", (_lang, names) => {
    expect(bookNameCollisions(names)).toEqual([])
  })

  it("em português, `jo` sem acento é disputado por Jó e João (por isso o acento decide)", () => {
    expect(contestedSpellings(ptBooks)).toContain("jo")
  })
})

/** Resultado no formato das tabelas de aceitação. */
function outcome(typed: string, names: BookNames): string {
  const result = parseReference(typed, names)
  if (result.ok) return toOsis(result.reference)
  if (result.error.kind === "ambiguous-book") return `ambiguous:${result.error.candidates.join(",")}`
  if (result.error.kind === "unknown-book") return "unknown"
  return result.error.kind
}

describe("aceitação: o que um leitor digita e o que precisa achar", () => {
  it.each(ACCEPTANCE_EN)("en: %j → %s", (typed, expected) => {
    expect(outcome(typed, enBooks)).toBe(expected)
  })
  it.each(ACCEPTANCE_PT)("pt: %j → %s", (typed, expected) => {
    expect(outcome(typed, ptBooks)).toBe(expected)
  })
})

describe("parseReference", () => {
  const parse = (input: string, names: BookNames = enBooks) => parseReference(input, names)

  it.each<[string, BibleReference]>([
    ["John 3:16", { book: "John", chapter: 3, verse: 16 }],
    ["jn 3 16", { book: "John", chapter: 3, verse: 16 }],
    ["john3:16", { book: "John", chapter: 3, verse: 16 }],
    ["1co13.4", { book: "1Cor", chapter: 13, verse: 4 }],
    ["Gen.1.1", { book: "Gen", chapter: 1, verse: 1 }],
    ["Song of Solomon 2:1", { book: "Song", chapter: 2, verse: 1 }],
    ["  II Kings 2 : 11 ", { book: "2Kgs", chapter: 2, verse: 11 }],
    ["Ps 23", { book: "Ps", chapter: 23 }],
    // intervalos
    ["John 3:16-18", { book: "John", chapter: 3, verse: 16, end: { chapter: 3, verse: 18 } }],
    ["John 3:16–18", { book: "John", chapter: 3, verse: 16, end: { chapter: 3, verse: 18 } }],
    ["Gen 1:31-2:3", { book: "Gen", chapter: 1, verse: 31, end: { chapter: 2, verse: 3 } }],
    ["Ps 23-24", { book: "Ps", chapter: 23, end: { chapter: 24 } }],
    ["Rom 1:19 - 20", { book: "Rom", chapter: 1, verse: 19, end: { chapter: 1, verse: 20 } }],
    ["John 3:16-16", { book: "John", chapter: 3, verse: 16 }],
  ])("lê %j", (input, reference) => {
    expect(parse(input)).toEqual({ ok: true, reference })
  })

  it.each<[string, string, BibleReference]>([
    ["Gn 1.31-2.3", "pt", { book: "Gen", chapter: 1, verse: 31, end: { chapter: 2, verse: 3 } }],
    ["1º Coríntios 13:4-7", "pt", { book: "1Cor", chapter: 13, verse: 4, end: { chapter: 13, verse: 7 } }],
    ["Sl 1–2", "pt", { book: "Ps", chapter: 1, end: { chapter: 2 } }],
    ["Jo 3,16", "pt", { book: "John", chapter: 3, verse: 16 }],
  ])("lê %j (%s)", (input, _lang, reference) => {
    expect(parse(input, ptBooks)).toEqual({ ok: true, reference })
  })

  it.each([
    ["", { kind: "unreadable" }],
    ["John", { kind: "unreadable" }],
    ["Hezekiah 1:1", { kind: "unknown-book", query: "Hezekiah" }],
    ["Genesis 51:1", { kind: "no-such-chapter", book: "Gen", chapter: 51, chapters: 50 }],
    ["Psalms 23:7", { kind: "no-such-verse", book: "Ps", chapter: 23, verse: 7, verses: 6 }],
    ["John 3:0", { kind: "no-such-verse", book: "John", chapter: 3, verse: 0, verses: 36 }],
    ["John 3:18-16", { kind: "invalid-range" }],
    ["John 3:16-40", { kind: "no-such-verse", book: "John", chapter: 3, verse: 40, verses: 36 }],
    ["Gen 2:3-1:31", { kind: "invalid-range" }],
    ["Ps 24-23", { kind: "invalid-range" }],
    ["Ps 150-151", { kind: "no-such-chapter", book: "Ps", chapter: 151, chapters: 150 }],
    ["Ps 23-24:1", { kind: "invalid-range" }],
  ])("recusa %j", (input, error) => {
    expect(parse(input)).toEqual({ ok: false, error })
  })
})

describe("formatReference", () => {
  const ref = (input: string) => {
    const result = parseReference(input)
    if (!result.ok) throw new Error(input)
    return result.reference
  }

  it.each([
    ["John 3:16", "João 3:16", "Jo 3:16"],
    ["John 3:16-18", "João 3:16–18", "Jo 3:16–18"],
    ["Gen 1:31-2:3", "Gênesis 1:31–2:3", "Gn 1:31–2:3"],
    ["Ps 23", "Salmo 23", "Sl 23"],
    ["Ps 23:1", "Salmo 23:1", "Sl 23:1"],
    ["Ps 23-24", "Salmos 23–24", "Sl 23–24"],
    ["Job 1:1", "Jó 1:1", "Jó 1:1"],
  ])("%j → %j / %j", (input, full, short) => {
    expect(formatReference(ref(input), ptBooks)).toBe(full)
    expect(formatReference(ref(input), ptBooks, { abbreviated: true })).toBe(short)
  })

  it("formata em inglês com o nome de citação", () => {
    expect(formatReference(ref("Psalms 23:1"), enBooks)).toBe("Psalm 23:1")
    expect(formatReference(ref("1 Cor 13:4-7"), enBooks)).toBe("1 Corinthians 13:4–7")
  })

  it("o que é formatado em pt é lido de volta em pt", () => {
    for (const input of ["John 3:16-18", "Gen 1:31-2:3", "Ps 23-24", "Song 2:1", "3 John 1:14"]) {
      const original = ref(input)
      for (const abbreviated of [false, true]) {
        const text = formatReference(original, ptBooks, { abbreviated })
        expect(parseReference(text, ptBooks)).toEqual({ ok: true, reference: original })
      }
    }
  })

  it("localizeReference traduz o `ref` de <Scripture>", () => {
    expect(localizeReference("John 3:16-18", enBooks, ptBooks)).toBe("João 3:16–18")
    expect(localizeReference("Malachi 3:6", enBooks, ptBooks, { abbreviated: true })).toBe("Ml 3:6")
    expect(localizeReference("Hezekiah 1:1", enBooks, ptBooks)).toBeNull()
  })
})

describe("índices e OSIS", () => {
  it("referenceRange cobre capítulos, versículos e intervalos", () => {
    expect(referenceRange({ book: "Gen", chapter: 1 })).toEqual({ start: 0, end: 30 })
    expect(referenceRange({ book: "Gen", chapter: 1, end: { chapter: 2 } })).toEqual({ start: 0, end: 55 })
    expect(referenceRange({ book: "Gen", chapter: 1, verse: 31, end: { chapter: 2, verse: 3 } })).toEqual({ start: 30, end: 33 })
    expect(() => referenceRange({ book: "Gen", chapter: 51 })).toThrow(RangeError)
  })

  it("referenceFromRange devolve a referência (ou nada, se atravessa livros)", () => {
    expect(referenceFromRange({ start: 30, end: 33 })).toEqual({ book: "Gen", chapter: 1, verse: 31, end: { chapter: 2, verse: 3 } })
    expect(referenceFromRange({ start: 26136, end: 26136 })).toEqual({ book: "John", chapter: 3, verse: 16 })
    expect(referenceFromRange({ start: 1532, end: 1534 })).toBeUndefined() // Gn 50:26 – Êx 1:2
  })

  it.each([
    ["John.3.16", { book: "John", chapter: 3, verse: 16 }],
    ["Rom.1.19-Rom.1.20", { book: "Rom", chapter: 1, verse: 19, end: { chapter: 1, verse: 20 } }],
    ["Gen.1.31-Gen.2.3", { book: "Gen", chapter: 1, verse: 31, end: { chapter: 2, verse: 3 } }],
    ["Ps.23", { book: "Ps", chapter: 23 }],
    ["Ps.23-Ps.24", { book: "Ps", chapter: 23, end: { chapter: 24 } }],
  ])("OSIS %s ida e volta", (osis, reference) => {
    expect(parseOsis(osis)).toEqual(reference)
    expect(toOsis(reference as BibleReference)).toBe(osis)
  })

  it.each(["Gen.51.1", "John.3.37", "Xyz.1.1", "Gen.2.1-Gen.1.1", "Gen.50.26-Exod.1.1", "Ps.23-Ps.24.1", "John 3:16"])(
    "parseOsis recusa %s",
    (osis) => {
      expect(parseOsis(osis)).toBeUndefined()
    },
  )

  it("parseOsisRange aceita intervalos entre livros (como no OpenBible)", () => {
    expect(parseOsisRange("Gen.50.26-Exod.1.1")).toEqual({ start: 1532, end: 1533 })
    expect(parseOsisRange("Rom.1.19-Rom.1.20")).toEqual(referenceRange({ book: "Rom", chapter: 1, verse: 19, end: { chapter: 1, verse: 20 } }))
    expect(parseOsisRange("Gen.2.1-Gen.1.1")).toBeUndefined()
  })
})
