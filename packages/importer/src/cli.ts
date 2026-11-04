/**
 * Importação do acervo legado (`content/sermons/en-US`) em duas fases:
 *
 *   1. convert  → normaliza cada texto para MDX em `content/mdx/sermons/<autor>/<slug>.mdx`
 *                 e grava `report.json` (avisos, erros). Revise e corrija os arquivos no git.
 *   2. apply    → lê os MDX revisados e cria autores e obras (rascunho) no Supabase.
 *                 Usa SUPABASE_SECRET_KEY (só na sua máquina); obras já existentes são puladas.
 *
 * Exemplos (na raiz do repositório):
 *   pnpm --filter @euaggelion/importer convert -- --author c_h_spurgeon --limit 20
 *   pnpm --filter @euaggelion/importer apply -- --author c-h-spurgeon --dry-run
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

import { createClient } from "@supabase/supabase-js"

import { datePrecision, parseMdx, type WorkType } from "@euaggelion/mdx"

import { LEGACY_AUTHORS } from "./authors"
import { convertLegacy } from "./legacy"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const LEGACY_DIR = join(ROOT, "content/sermons/en-US")
const MDX_DIR = join(ROOT, "content/mdx/sermons")

/** Tipo padrão por autor (cartas, tratados e folhetos viram "article"). Revise no MDX. */
const DEFAULT_TYPE: Record<string, WorkType> = {
  c_h_spurgeon: "sermon",
  george_whitefield: "sermon",
  j_c_philpot: "sermon",
  samuel_davies: "sermon",
  jonathan_edwards: "sermon",
  j_c_ryle: "article",
  john_bunyan: "article",
  john_newton: "article",
  john_owen: "article",
  thomas_watson: "article",
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    author: { type: "string" },
    limit: { type: "string" },
    out: { type: "string" },
    dir: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
})

const command = positionals[0]
if (command === "convert") convert()
else if (command === "apply") await apply()
else {
  console.error("Uso: cli.ts convert|apply [--author <pasta|slug>] [--limit N] [--out DIR] [--dir DIR] [--dry-run]")
  process.exit(1)
}

function convert() {
  const out = values.out ? resolve(values.out) : MDX_DIR
  const limit = values.limit ? Number(values.limit) : Infinity
  const dirs = values.author ? [values.author] : readdirSync(LEGACY_DIR).sort()
  const report: Record<string, unknown>[] = []
  const totals = { files: 0, valid: 0, invalid: 0, warnings: 0, copyright: 0 }

  for (const dir of dirs) {
    const author = LEGACY_AUTHORS[dir]
    if (!author) {
      console.warn(`! pasta sem autor mapeado (src/authors.ts): ${dir}`)
      continue
    }
    const files = readdirSync(join(LEGACY_DIR, dir)).filter((f) => f.endsWith(".md")).sort().slice(0, limit)
    const used = new Set<string>()
    mkdirSync(join(out, author.slug), { recursive: true })

    for (const file of files) {
      const raw = readFileSync(join(LEGACY_DIR, dir, file), "utf8")
      const type: WorkType = /biograph/i.test(file) ? "article" : (DEFAULT_TYPE[dir] ?? "sermon")
      const result = convertLegacy(raw, { author, file, type })

      let slug = result.slug
      for (let n = 2; used.has(slug); n++) slug = `${result.slug}-${n}`
      used.add(slug)
      // O slug vai no frontmatter para a importação ser idempotente (mesmo arquivo → mesma obra)
      const mdx = result.mdx.replace(/^---\n/, `---\nslug: ${slug}\n`)
      writeFileSync(join(out, author.slug, `${slug}.mdx`), mdx)

      totals.files++
      if (result.valid) totals.valid++
      else totals.invalid++
      if (result.warnings.length) totals.warnings++
      if (result.credits) totals.copyright++
      report.push({
        source: `${dir}/${file}`,
        output: `${author.slug}/${slug}.mdx`,
        title: result.title,
        date: result.date ?? null,
        segments: result.segmentCount,
        valid: result.valid,
        error: result.error ?? null,
        warnings: result.warnings,
      })
    }
    console.log(`${author.name}: ${files.length} arquivo(s)`)
  }

  writeFileSync(join(out, "report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), totals, items: report }, null, 2)}\n`)
  console.log(
    `\n${totals.files} convertido(s): ${totals.valid} válido(s), ${totals.invalid} com erro, ` +
      `${totals.warnings} com avisos (${totals.copyright} com aviso de copyright).\nRelatório: ${join(out, "report.json")}`,
  )
}

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
      if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2")
    }
  }
}

async function apply() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ex.: no .env da raiz).")
    process.exit(1)
  }
  const dryRun = values["dry-run"]
  const dir = values.dir ? resolve(values.dir) : MDX_DIR
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const authors = Object.values(LEGACY_AUTHORS).filter((a) => !values.author || a.slug === values.author)
  const counts = { created: 0, skipped: 0, invalid: 0, failed: 0 }

  for (const author of authors) {
    const folder = join(dir, author.slug)
    if (!existsSync(folder)) continue

    let { data: row } = await supabase.from("authors").select("id").eq("slug", author.slug).maybeSingle()
    if (!row && !dryRun) {
      const created = await supabase.from("authors").insert({ name: author.name, slug: author.slug, era: author.era }).select("id").single()
      if (created.error) throw new Error(`Autor ${author.slug}: ${created.error.message}`)
      row = created.data
      console.log(`+ autor ${author.name}`)
    }

    const existing = new Set<string>()
    if (row) {
      const { data } = await supabase.from("works").select("slug").eq("author_id", row.id)
      for (const w of data ?? []) existing.add(w.slug)
    }

    const files = readdirSync(folder).filter((f) => f.endsWith(".mdx")).sort()
    for (const file of files) {
      const mdx = readFileSync(join(folder, file), "utf8")
      let parsed
      try {
        parsed = parseMdx(mdx)
      } catch (error) {
        counts.invalid++
        console.log(`✗ ${author.slug}/${file}: ${(error as Error).message}`)
        continue
      }
      const m = parsed.metadata
      if (!m || parsed.segments.length === 0) {
        counts.invalid++
        console.log(`✗ ${author.slug}/${file}: ${parsed.frontmatterIssues.map((i) => i.message).join("; ") || "sem segmentos"}`)
        continue
      }
      if (m.author !== author.slug) {
        counts.invalid++
        console.log(`✗ ${author.slug}/${file}: frontmatter.author (${m.author}) diferente da pasta`)
        continue
      }
      const slug = m.slug ?? file.replace(/\.mdx$/, "")
      if (existing.has(slug)) {
        counts.skipped++
        continue
      }
      if (dryRun) {
        counts.created++
        console.log(`~ ${author.slug}/${slug} (${parsed.segments.length} segmentos)`)
        continue
      }
      const { error } = await supabase.rpc("create_work", {
        p_author_id: row!.id,
        p_type: m.type,
        p_slug: slug,
        p_mdx: parsed.source,
        p_segments: parsed.segments as never,
        p_frontmatter: parsed.frontmatter as never,
        p_date_text: m.date,
        p_date_precision: datePrecision(m.date),
        p_source: m.source,
        p_credits: m.credits,
      })
      if (error) {
        counts.failed++
        console.log(`✗ ${author.slug}/${slug}: ${error.message}`)
      } else {
        counts.created++
        existing.add(slug)
        console.log(`+ ${author.slug}/${slug}`)
      }
    }
  }

  console.log(
    `\n${dryRun ? "[simulação] " : ""}${counts.created} obra(s) ${dryRun ? "seriam criadas" : "criada(s)"}, ` +
      `${counts.skipped} já existiam, ${counts.invalid} inválida(s), ${counts.failed} falha(s).`,
  )
  if (counts.invalid || counts.failed) process.exitCode = 1
}
