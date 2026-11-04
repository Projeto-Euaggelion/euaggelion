import { describe, expect, it } from "vitest"

import { parseMdx } from "@euaggelion/mdx"

import { LEGACY_AUTHORS } from "../src/authors"
import { balanceEmphasis, convertLegacy, escapeMdx, findDate, titleCaseIfShouting } from "../src/legacy"

const spurgeon = LEGACY_AUTHORS.c_h_spurgeon!
const edwards = LEGACY_AUTHORS.jonathan_edwards!
const philpot = LEGACY_AUTHORS.j_c_philpot!

const LONG =
  "One wise man may deliver a whole city; one good man may be the means of safety\n" +
  "to a thousand others. The holy ones are the salt of the earth, the means\n" +
  "of the preservation of the wicked. Without the godly as a safeguard, the race\n" +
  "would be utterly destroyed. In the city of Samaria there was one righteous man."

describe("convertLegacy", () => {
  it("extrai título, fonte, data e copyright do cabeçalho de Spurgeon e desfaz as quebras de linha", () => {
    const raw = [
      "# The Sin of Unbelief - C. H. Spurgeon",
      "",
      "Fonte: http://www.biblebb.com/files/spurgeon/0003.htm",
      "",
      "---",
      "",
      "**The Sin of Unbelief",
      "",
      "January 14, 1855",
      "by",
      "C. H. SPURGEON",
      "(1834-1892)",
      "",
      "This updated and revised manuscript is",
      "copyrighted ã 2000 by Tony Capoccia. All rights",
      "reserved.",
      " ",
      '"Could this happen?" [2 Kings 7:19]**',
      "",
      LONG,
    ].join("\n")

    const r = convertLegacy(raw, { author: spurgeon, file: "0003.md", type: "sermon" })
    expect(r.valid).toBe(true)
    expect(r.title).toBe("The Sin of Unbelief")
    expect(r.slug).toBe("the-sin-of-unbelief")
    expect(r.date).toBe("1855-01-14")
    expect(r.source).toBe("http://www.biblebb.com/files/spurgeon/0003.htm")
    expect(r.credits).toBe("This updated and revised manuscript is copyrighted © 2000 by Tony Capoccia. All rights reserved.")
    expect(r.warnings.some((w) => w.includes("direitos autorais"))).toBe(true)

    const parsed = parseMdx(r.mdx)
    expect(parsed.metadata).toMatchObject({ title: "The Sin of Unbelief", author: "c-h-spurgeon", type: "sermon", date: "1855-01-14" })
    const body = parsed.segments.filter((s) => s.kind === "paragraph").map((s) => s.text)
    // Bloco de autoria removido; ênfase desbalanceada ("**" sem par) removida
    expect(body[0]).toBe('"Could this happen?" [2 Kings 7:19]')
    expect(body[1]).toBe(LONG.replace(/\n/g, " "))
    expect(r.mdx).not.toMatch(/SPURGEON|1834-1892|\bby\b\n/)
  })

  it("separa partes coladas pelo HTML e converte títulos (Edwards)", () => {
    const raw = [
      "# Christian Cautions -- Jonathan Edwards",
      "",
      "Fonte: https://www.biblebb.com/files/edwards/cautions.htm",
      "",
      "---",
      "",
      "# *Christian Cautions*",
      "",
      "# *The Necessity of Self-Examination***by",
      "",
      " Jonathan Edwards",
      " (1703-1758)**Dated September 1733.",
      "",
      "**INTRODUCTION**",
      "",
      LONG,
    ].join("\n")
    const r = convertLegacy(raw, { author: edwards, file: "cautions.md", type: "sermon" })
    expect(r.valid).toBe(true)
    expect(r.title).toBe("Christian Cautions")
    expect(r.date).toBe("1733-09")
    expect(r.mdx).toContain("## The Necessity of Self-Examination\n")
    expect(r.mdx).toContain("## Introduction\n")
    expect(r.mdx).not.toContain("Jonathan Edwards\n")
    expect(r.mdx).not.toContain("1703")
  })

  it("remove o 'by Autor' das linhas do bloco de autoria e mantém o local da pregação", () => {
    const raw = [
      "# Alienation and Reconciliation",
      "",
      "Fonte: https://example.org/x.htm",
      "",
      "---",
      "",
      "**Alienation and",
      "Reconciliation**",
      "",
      "Preached at North Street Chapel, Stamford,",
      "",
      "on February 16, 1862, by J. C. Philpot",
      "",
      LONG,
    ].join("\n")
    const r = convertLegacy(raw, { author: philpot, file: "x.md", type: "sermon" })
    expect(r.date).toBe("1862-02-16")
    expect(r.mdx).toContain("Preached at North Street Chapel, Stamford,\n\non February 16, 1862\n")
    expect(r.mdx).not.toContain("Alienation and\n")
  })

  it("escapa o que o MDX leria como JSX, expressão ou bloco", () => {
    const raw = [
      "# Odd Text",
      "",
      "---",
      "",
      LONG,
      "",
      "Psalm 18:2 deliverer<193>I will {call} upon <b>the Lord</b>.",
      "",
      "1. This was not meant as a list.",
      "",
      "import is a word, not ESM.",
    ].join("\n")
    const r = convertLegacy(raw, { author: spurgeon, file: "odd.md", type: "sermon" })
    expect(r.valid).toBe(true)
    expect(r.warnings.some((w) => w.includes("HTML"))).toBe(true)
    const texts = parseMdx(r.mdx).segments.map((s) => s.text)
    expect(texts).toContain("Psalm 18:2 deliverer&lt;193>I will &#123;call&#125; upon &lt;b>the Lord&lt;/b>.")
    expect(texts).toContain("1\\. This was not meant as a list.")
    expect(texts).toContain("&#105;mport is a word, not ESM.")
  })
})

describe("título", () => {
  it("prefere a 1ª linha do texto quando o cabeçalho traz só um rótulo curto", () => {
    const raw = ["# Immutability [02]", "", "Fonte: x", "", "---", "", "The Immutability of God", "", "January 7, 1855", "", LONG].join("\n")
    const r = convertLegacy(raw, { author: spurgeon, file: "0001.md", type: "sermon" })
    expect(r.title).toBe("The Immutability of God")
    expect(r.slug).toBe("the-immutability-of-god")
    expect(r.mdx).not.toContain("\nThe Immutability of God\n")
  })

  it("remove a autoria colada ao título", () => {
    const raw = ["# Touchstone", "", "---", "", "The Touchstone of Godly SinceritybyC. H. SPURGEON(1834-1892)", "", LONG].join("\n")
    expect(convertLegacy(raw, { author: spurgeon, file: "x.md", type: "sermon" }).title).toBe("The Touchstone of Godly Sincerity")
    const glued = ["# Leaves", "", "---", "", "Nothing But LeavesFebruary 21st, 1864byC. H. SPURGEON", "", LONG].join("\n")
    const r = convertLegacy(glued, { author: spurgeon, file: "y.md", type: "sermon" })
    expect(r.title).toBe("Nothing But Leaves")
    expect(r.date).toBe("1864-02-21")
  })
})

describe("helpers", () => {
  it("findDate reconhece dia, mês e ano", () => {
    expect(findDate("January 7, 1855")).toEqual({ date: "1855-01-07", whole: true })
    expect(findDate("Dated April, 1736")).toEqual({ date: "1736-04", whole: true })
    expect(findDate("*1680.*")).toEqual({ date: "1680", whole: true })
    expect(findDate("on February 16, 1862, at Stamford")).toEqual({ date: "1862-02-16", whole: false })
    expect(findDate("Psalm 73:25")).toBeNull()
  })

  it("titleCaseIfShouting só mexe em texto todo em maiúsculas", () => {
    expect(titleCaseIfShouting("ARE WE SANCTIFIED")).toBe("Are We Sanctified")
    expect(titleCaseIfShouting("THE LIGHT OF THE WORLD")).toBe("The Light of the World")
    expect(titleCaseIfShouting("The LORD Is My Shepherd")).toBe("The LORD Is My Shepherd")
  })

  it("balanceEmphasis remove asteriscos sem par e preserva os balanceados", () => {
    expect(balanceEmphasis("a **b** and *c*")).toBe("a **b** and *c*")
    expect(balanceEmphasis("**Title only")).toBe("Title only")
    expect(balanceEmphasis("x *y")).toBe("x y")
  })

  it("escapeMdx usa referências de caractere", () => {
    expect(escapeMdx("a {b} <c")).toBe("a &#123;b&#125; &lt;c")
  })
})
