import type { Metadata } from "next"
import Form from "next/form"
import Link from "next/link"
import { Suspense } from "react"
import { LibraryIcon, PlusIcon, SearchIcon } from "lucide-react"

import { Badge } from "@euaggelion/ui/components/badge"
import { Button } from "@euaggelion/ui/components/button"
import { Input } from "@euaggelion/ui/components/input"
import { NativeSelect } from "@euaggelion/ui/components/native-select"
import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@euaggelion/ui/components/table"
import { WORK_TYPES } from "@euaggelion/mdx/schema"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { EmptyState } from "@/components/catalog/empty-state"
import { WorkStatusBadge } from "@/components/catalog/status-badges"
import { getLutherPermissions } from "@/lib/access"
import { listAuthors, listWorks, type WorkFilters } from "@/lib/data/catalog"
import { formatWorkDate, WORK_STATUSES, WORK_STATUS_LABELS, WORK_TYPE_LABELS, type WorkStatus } from "@/lib/format"

export const metadata: Metadata = { title: "Obras" }

type SearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v?.trim() || undefined
}

function toFilters(sp: SearchParams): WorkFilters {
  const type = one(sp.type)
  const status = one(sp.status)
  return {
    q: one(sp.q)?.slice(0, 100),
    author: one(sp.author),
    type: WORK_TYPES.includes(type as never) ? (type as WorkFilters["type"]) : undefined,
    status: WORK_STATUSES.includes(status as never) ? (status as WorkFilters["status"]) : undefined,
    page: Number(one(sp.page)) || 1,
  }
}

export default function WorksPage({ searchParams }: PageProps<"/works">) {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        actions={
          <Suspense>
            <NewWorkButton />
          </Suspense>
        }
      >
        <span className="text-sm font-medium">Obras</span>
      </AppHeader>
      <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:p-6">
        <Suspense fallback={<WorksSkeleton />}>
          <WorksContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function NewWorkButton() {
  const { canManageCatalog } = await getLutherPermissions()
  if (!canManageCatalog) return null
  return (
    <Button size="sm" asChild>
      <Link href="/works/new">
        <PlusIcon /> Nova obra
      </Link>
    </Button>
  )
}

async function WorksContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = toFilters(await searchParams)
  const [{ works, total, page, pageCount }, authors] = await Promise.all([listWorks(filters), listAuthors()])
  const filtered = !!(filters.q || filters.author || filters.type || filters.status)

  const pageHref = (p: number) => {
    const params = new URLSearchParams()
    if (filters.q) params.set("q", filters.q)
    if (filters.author) params.set("author", filters.author)
    if (filters.type) params.set("type", filters.type)
    if (filters.status) params.set("status", filters.status)
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return qs ? `/works?${qs}` : "/works"
  }

  return (
    <>
      <Form action="/works" className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={filters.q} placeholder="Buscar pelo título…" aria-label="Buscar pelo título" className="pl-8" />
        </div>
        <NativeSelect name="author" defaultValue={filters.author ?? ""} aria-label="Autor">
          <option value="">Todos os autores</option>
          {authors.map((a) => (
            <option key={a.id} value={a.slug}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={filters.type ?? ""} aria-label="Tipo">
          <option value="">Todos os tipos</option>
          {WORK_TYPES.map((t) => (
            <option key={t} value={t}>
              {WORK_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Todos os status</option>
          {WORK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {WORK_STATUS_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {filtered && (
          <Button variant="ghost" asChild>
            <Link href="/works">Limpar</Link>
          </Button>
        )}
      </Form>

      {works.length === 0 ? (
        <EmptyState
          icon={LibraryIcon}
          title={filtered ? "Nenhuma obra encontrada" : "Nenhuma obra cadastrada"}
          description={filtered ? "Ajuste os filtros da busca." : "Importe um texto em MDX para começar."}
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Traduções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {works.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="max-w-80 font-medium">
                      <Link href={`/works/${w.id}`} className="block truncate hover:underline">
                        {w.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link href={`/authors/${w.author.slug}`} className="hover:underline">
                        {w.author.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{WORK_TYPE_LABELS[w.type]}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatWorkDate(w.date_text) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <WorkStatusBadge status={w.status as WorkStatus} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex gap-1">
                        {w.translations.length === 0 && <span className="text-muted-foreground">—</span>}
                        {w.translations.map((t) => (
                          <Badge
                            key={t.language}
                            variant={t.published_version_id ? "default" : "outline"}
                            title={t.published_version_id ? "Publicada" : "Em andamento"}
                            className="font-mono text-[0.7rem]"
                          >
                            {t.language}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <nav aria-label="Paginação" className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} {total === 1 ? "obra" : "obras"}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                  {page > 1 ? <Link href={pageHref(page - 1)}>Anterior</Link> : <span>Anterior</span>}
                </Button>
                <span>
                  {page} de {pageCount}
                </span>
                <Button variant="outline" size="sm" asChild disabled={page >= pageCount}>
                  {page < pageCount ? <Link href={pageHref(page + 1)}>Próxima</Link> : <span>Próxima</span>}
                </Button>
              </div>
            )}
          </nav>
        </>
      )}
    </>
  )
}

function WorksSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}
