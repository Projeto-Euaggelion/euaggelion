import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  datePrecision,
  MdxSyntaxError,
  parseMdx,
  ReconstructError,
  reconstructMdx,
  validateTranslation,
} from "../src"

const sermon = readFileSync(new URL("./fixtures/sermon.mdx", import.meta.url), "utf8")

const byPath = (mdx: string) => Object.fromEntries(parseMdx(mdx).segments.map((s) => [s.ast_path, s]))

describe("parseMdx: frontmatter", () => {
  it("valida e normaliza os metadados da obra", () => {
    const { metadata, frontmatterIssues } = parseMdx(sermon)
    expect(frontmatterIssues).toEqual([])
    expect(metadata).toMatchObject({
      title: "The Immutability of God",
      author: "charles-spurgeon",
      type: "sermon",
      date: "1855-01-07",
      credits: "Public domain",
    })
    expect(datePrecision(metadata!.date)).toBe("day")
  })

  it("aceita ano numérico (YAML) e reporta campos inválidos", () => {
    const ok = parseMdx("---\ntitle: A\nauthor: b\ntype: article\ndate: 1857\n---\n\nText.")
    expect(ok.metadata?.date).toBe("1857")
    expect(datePrecision(ok.metadata!.date)).toBe("year")

    const bad = parseMdx("---\ntitle: A\ntype: poem\ndate: 1857-13\n---\n\nText.")
    expect(bad.metadata).toBeNull()
    expect(bad.frontmatterIssues.map((i) => i.path).sort()).toEqual(["author", "date", "type"])
  })

  it("reporta frontmatter ausente ou YAML inválido sem impedir a segmentação", () => {
    const none = parseMdx("Just text.")
    expect(none.frontmatterIssues[0]?.code).toBe("frontmatter_missing")
    expect(none.segments).toHaveLength(1)

    const broken = parseMdx("---\ntitle: [unclosed\n---\n\nText.")
    expect(broken.frontmatterIssues[0]?.code).toBe("frontmatter_yaml")
    expect(broken.segments.map((s) => s.kind)).toEqual(["paragraph"])
  })
})

describe("parseMdx: segmentação", () => {
  const { segments } = parseMdx(sermon)

  it("gera segmentos em ordem, com posições contínuas e ast_path único", () => {
    expect(segments.map((s) => s.position)).toEqual(segments.map((_, i) => i))
    expect(new Set(segments.map((s) => s.ast_path)).size).toBe(segments.length)
  })

  it("classifica cada bloco pelo tipo", () => {
    expect(segments.map((s) => [s.kind, s.text.slice(0, 24)])).toEqual([
      ["title", "The Immutability of God"],
      ["description", "The first sermon preache"],
      ["heading", "Introduction"],
      ["paragraph", "It has been said by some"],
      ["quote", "There is something excee"],
      ["quote", "For I am the Lord, I cha"],
      ["attribute", "Augustine, Confessions"],
      ["quote", "Thou hast made us for th"],
      ["paragraph", "Spurgeon was twenty year"],
      ["heading", "Three points"],
      ["list_item", "First, the *nature* of G"],
      ["list_item", "Second, see [his promise"],
      ["list_item", "An item with a nested li"],
      ["list_item", "Nested **item**."],
      ["paragraph", "Attribute"],
      ["paragraph", "Proof"],
      ["paragraph", "Essence"],
      ["paragraph", "Malachi 3:6"],
      ["footnote", "Pope wrote the line quot"],
    ])
  })

  it("mantém a formatação inline como MDX e remove marcadores de bloco", () => {
    const p = segments.find((s) => s.kind === "paragraph")!
    expect(p.text).toContain("is **God**; the proper study of a Christian is the *Godhead*.[^1]")
    expect(p.text.split("\n")).toHaveLength(3)

    const quote = segments.find((s) => s.kind === "quote")!
    expect(quote.text).toBe("There is something exceedingly improving to the mind\nin a contemplation of the Divinity.")

    const jsx = segments.find((s) => s.text.startsWith("Thou hast"))!
    expect(jsx.text).toBe("Thou hast made us for thyself,\nand our heart is restless until it rests in thee.")

    const item = segments.find((s) => s.text.startsWith("Second"))!
    expect(item.text).toBe(
      "Second, see [his promises](https://example.com/promises) and his `threatenings`.\nThey are also unchanging.",
    )

    const note = segments.at(-1)!
    expect(note.text).toBe("Pope wrote the line quoted at the start,\nin his *Essay on Man*.")
  })

  it("não segmenta imports, código, expressões, imagens nem atributos não traduzíveis", () => {
    const all = segments.map((s) => s.text).join("\n")
    expect(all).not.toContain("import")
    expect(all).not.toContain("untouched")
    expect(all).not.toContain("props.year")
    expect(all).not.toContain("pulpit.png")
    expect(all).not.toContain("Malachi 3:6\">")
    expect(segments.filter((s) => s.kind === "attribute").map((s) => s.ast_path)).toEqual(["6@source"])
  })

  it("é determinística e normaliza CRLF/BOM", () => {
    const crlf = `﻿${sermon.replace(/\n/g, "\r\n")}`
    expect(parseMdx(crlf).segments).toEqual(segments)
    expect(parseMdx(crlf).source).toBe(sermon)
  })

  it("lança MdxSyntaxError com a posição em MDX inválido", () => {
    expect(() => parseMdx("Text with <Unclosed attr.\n")).toThrow(MdxSyntaxError)
    try {
      parseMdx("ok\n\nan { unclosed expression")
    } catch (error) {
      expect((error as MdxSyntaxError).line).toBe(3)
    }
  })
})

describe("reconstructMdx", () => {
  const segments = parseMdx(sermon).segments
  const identity = Object.fromEntries(segments.map((s) => [s.ast_path, s.text]))

  it("reproduz o original byte a byte quando nada muda", () => {
    expect(reconstructMdx(sermon, identity)).toBe(sermon)
  })

  it("substitui só o conteúdo dos segmentos e preserva o resto", () => {
    const pt = byPath(sermon)
    const translations = {
      ...identity,
      [pt["frontmatter.title"]!.ast_path]: "A Imutabilidade de Deus",
      [segments[2]!.ast_path]: "Introdução",
      [segments[4]!.ast_path]: "Há algo extremamente proveitoso para a mente\nna contemplação da Divindade.",
      "6@source": 'Agostinho, "Confissões"',
      [segments[7]!.ast_path]: "Tu nos fizeste para ti,\ne o nosso coração está inquieto até descansar em ti.",
      [segments[11]!.ast_path]:
        "Em segundo lugar, veja [suas promessas](https://example.com/promises) e suas `threatenings`.\nElas também não mudam.",
      [segments.at(-1)!.ast_path]: "Pope escreveu a linha citada no início,\nem seu *Ensaio sobre o Homem*.",
    }
    const out = reconstructMdx(sermon, translations, { frontmatter: { language: "pt-BR" } })

    expect(out).toContain("title: A Imutabilidade de Deus")
    expect(out).toContain("language: pt-BR")
    expect(out).toContain("author: charles-spurgeon")
    expect(out).toContain("# Introdução\n")
    expect(out).toContain("> Há algo extremamente proveitoso para a mente\n> na contemplação da Divindade.")
    expect(out).toContain('<Quote source="Agostinho, &quot;Confissões&quot;">')
    expect(out).toContain("2. Em segundo lugar, veja [suas promessas]")
    expect(out).toContain("\n   Elas também não mudam.")
    expect(out).toContain("[^1]: Pope escreveu a linha citada no início,\n    em seu *Ensaio sobre o Homem*.")
    expect(out).toContain('import { Aside } from "./aside"')
    expect(out).toContain('const untouched = "code is never translated";')
    expect(out).toContain('<Scripture ref="Malachi 3:6">')

    // Ida e volta: o resultado tem os mesmos segmentos, agora com o texto traduzido
    const again = byPath(out)
    for (const [path, text] of Object.entries(translations)) {
      expect(again[path]!.text).toBe(path === "6@source" ? "Agostinho, &quot;Confissões&quot;" : text)
    }
  })

  it("exige todos os segmentos, exceto com allowMissing", () => {
    const partial = { [segments[2]!.ast_path]: "Introdução" }
    expect(() => reconstructMdx(sermon, partial)).toThrow(ReconstructError)
    const preview = reconstructMdx(sermon, partial, { allowMissing: true })
    expect(preview).toContain("# Introdução")
    expect(preview).toContain("It has been said by someone")
  })

  it("rejeita ast_path desconhecido e traduções que quebram a estrutura", () => {
    expect(() => reconstructMdx(sermon, { ...identity, "99.0": "x" })).toThrow(/inexistentes/)
    expect(() => reconstructMdx(sermon, { ...identity, [segments[3]!.ast_path]: "Primeiro.\n\nSegundo." })).toThrow(
      ReconstructError,
    )
    expect(() => reconstructMdx(sermon, { ...identity, [segments[3]!.ast_path]: "Texto com { aberto" })).toThrow(
      MdxSyntaxError,
    )
  })

  it("mantém títulos e células em uma linha", () => {
    const out = reconstructMdx(sermon, { ...identity, [segments[2]!.ast_path]: "Intro-\ndução" })
    expect(out).toContain("# Intro- dução\n")
  })
})

describe("validateTranslation", () => {
  const source = "See [his promises](https://x.com/p), the *Godhead*,[^1] and `code`."

  it("aceita uma tradução que preserva a marcação", () => {
    const r = validateTranslation(source, "Veja [suas promessas](https://x.com/p), a *Divindade*,[^1] e `code`.", "paragraph")
    expect(r).toEqual({ ok: true, issues: [] })
  })

  it("aponta link, nota, código e ênfase perdidos ou alterados", () => {
    const r = validateTranslation(source, "Veja [suas promessas](https://x.com/outra), a Divindade e `codigo`.", "paragraph")
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code).sort()).toEqual([
      "mismatch_code",
      "mismatch_emphasis",
      "mismatch_footnotes",
      "mismatch_links",
    ])
  })

  it("exige componentes com os mesmos atributos não traduzíveis", () => {
    const src = '<Scripture ref="John 3:16">For God so loved</Scripture> the world.'
    expect(validateTranslation(src, '<Scripture ref="John 3:16">Porque Deus amou</Scripture> o mundo.', "paragraph").ok).toBe(true)
    expect(validateTranslation(src, '<Scripture ref="Jo 3:16">Porque Deus amou</Scripture> o mundo.', "paragraph").ok).toBe(false)
    expect(validateTranslation(src, "Porque Deus amou o mundo.", "paragraph").ok).toBe(false)
  })

  it("rejeita MDX inválido e mudança de estrutura do bloco", () => {
    expect(validateTranslation("Text.", "Texto com <tag", "paragraph").issues[0]?.code).toBe("syntax")
    expect(validateTranslation("Text.", "- Texto.", "list_item").issues[0]?.code).toBe("block_structure")
    expect(validateTranslation("Text.", "Um.\n\nDois.", "paragraph").issues[0]?.code).toBe("block_structure")
    expect(validateTranslation("Text.", "   ", "paragraph").issues[0]?.code).toBe("empty")
  })

  it("trata título, descrição e atributos como texto puro", () => {
    expect(validateTranslation("The Title", "O *Título*", "title").ok).toBe(true)
    expect(validateTranslation("Source", "Fonte\nquebrada", "attribute").issues[0]?.code).toBe("line_break")
  })
})

describe("contêineres aninhados", () => {
  it("reaplica os marcadores de lista e citação nas linhas de continuação", () => {
    const mdx = "- Item:\n  > quoted line one\n  > quoted line two\n\nAfter.\n"
    const [seg0, seg1] = parseMdx(mdx).segments
    expect(seg1!.kind).toBe("quote")
    expect(seg1!.text).toBe("quoted line one\nquoted line two")

    const out = reconstructMdx(mdx, {
      [seg0!.ast_path]: "Item:",
      [seg1!.ast_path]: "linha um\nlinha dois\nlinha três",
      "1": "Depois.",
    })
    expect(out).toBe("- Item:\n  > linha um\n  > linha dois\n  > linha três\n\nDepois.\n")
  })

  it("aceita continuação preguiçosa de citação e quebra forçada", () => {
    const mdx = "> first line\nlazy continuation\\\nafter break\n"
    const [seg] = parseMdx(mdx).segments
    expect(seg!.text).toBe("first line\nlazy continuation\\\nafter break")
    expect(validateTranslation(seg!.text, "primeira linha\ncontinuação\\\napós a quebra", "quote").ok).toBe(true)
    expect(validateTranslation(seg!.text, "primeira linha continuação após a quebra", "quote").ok).toBe(false)
  })
})
