import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AlertTriangleIcon, FilePlus2Icon, LanguagesIcon } from "lucide-react"

import { Badge } from "@euaggelion/ui/components/badge"
import { Button } from "@euaggelion/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@euaggelion/ui/components/card"
import { Progress } from "@euaggelion/ui/components/progress"
import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@euaggelion/ui/components/table"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { ContributorList } from "@/components/catalog/contributors"
import { EmptyState } from "@/components/catalog/empty-state"
import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { StartTranslationDialog } from "@/components/catalog/start-translation-dialog"
import { VersionStatusBadge, WorkStatusBadge } from "@/components/catalog/status-badges"
import { WorkEditDialog } from "@/components/catalog/work-edit-dialog"
import { getLutherPermissions } from "@/lib/access"
import { getSourceVersions, getTranslationOverview, getVersionContributors, getWork, listAuthors } from "@/lib/data/catalog"
import { formatDateTime, formatWorkDate, languageLabel, WORK_TYPE_LABELS, type WorkStatus } from "@/lib/format"
import { isUuid } from "@/lib/ids"

export const metadata: Metadata = { title: "Obra" }

export default function WorkPage({ params }: PageProps<"/works/[workId]">) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<WorkSkeleton />}>
        <WorkContent params={params} />
      </Suspense>
    </div>
  )
}

async function WorkContent({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params
  if (!isUuid(workId)) notFound()

  const [work, sources, translations, permissions] = await Promise.all([
    getWork(workId),
    getSourceVersions(workId),
    getTranslationOverview(workId),
    getLutherPermissions(),
  ])
  if (!work) notFound()
  const [authors, contributors] = await Promise.all([
    permissions.canManageCatalog ? listAuthors() : Promise.resolve([]),
    getVersionContributors(translations.map((t) => ({ id: t.id!, status: t.status ?? "" }))),
  ])

  const latestSource = sources[0]
  const languages = [...new Set(translations.map((t) => t.language).filter((l): l is string => !!l))]
  const busyLanguages = translations.filter((t) => t.status === "in_progress").map((t) => t.language!)

  return (
    <>
      <AppHeader
        actions={
          permissions.canManageCatalog && (
            <WorkEditDialog
              authors={authors.map((a) => ({ id: a.id, name: a.name }))}
              work={{
                id: work.id,
                authorId: work.author.id,
                type: work.type,
                status: work.status,
                slug: work.slug,
                date: work.date_text ?? "",
                source: work.source ?? "",
                credits: work.credits ?? "",
              }}
            />
          )
        }
      >
        <PageBreadcrumb
          items={[
            { label: "Obras", href: "/works" },
            { label: work.author.name, href: `/authors/${work.author.slug}` },
            { label: work.title },
          ]}
        />
      </AppHeader>

      <div className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-6">
        <section className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{work.title}</h1>
            <WorkStatusBadge status={work.status as WorkStatus} />
          </div>
          {work.description && <p className="max-w-3xl text-muted-foreground">{work.description}</p>}
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted-foreground">Autor</dt>
            <dd>
              <Link href={`/authors/${work.author.slug}`} className="hover:underline">
                {work.author.name}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{WORK_TYPE_LABELS[work.type]}</dd>
            <dt className="text-muted-foreground">Data</dt>
            <dd>{formatWorkDate(work.date_text) ?? "—"}</dd>
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono text-xs leading-5">{work.slug}</dd>
            <dt className="text-muted-foreground">Fonte</dt>
            <dd className="min-w-0 truncate">
              {work.source?.startsWith("http") ? (
                <a href={work.source} target="_blank" rel="noreferrer" className="hover:underline">
                  {work.source}
                </a>
              ) : (
                (work.source ?? "—")
              )}
            </dd>
            <dt className="text-muted-foreground">Créditos</dt>
            <dd>{work.credits ?? "—"}</dd>
          </dl>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Traduções</CardTitle>
            <CardDescription>No máximo uma tradução por idioma; retraduzir cria uma nova versão.</CardDescription>
            {permissions.canStartTranslation && latestSource && (
              <CardAction>
                <StartTranslationDialog workId={work.id} existingLanguages={languages} busyLanguages={busyLanguages} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {translations.length === 0 ? (
              <EmptyState
                icon={LanguagesIcon}
                title="Nenhuma tradução"
                description="Inicie a tradução em um idioma para abrir o editor."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Idioma</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-48">Aprovados</TableHead>
                    <TableHead className="hidden md:table-cell">Threads abertas</TableHead>
                    <TableHead className="hidden lg:table-cell">Colaboradores</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {translations.map((t) => {
                    const total = t.segments_total ?? 0
                    const approved = t.segments_approved ?? 0
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{languageLabel(t.language ?? "")}</TableCell>
                        <TableCell className="font-mono text-xs">
                          v{t.version}
                          {t.is_outdated && (
                            <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              <AlertTriangleIcon /> original mudou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <VersionStatusBadge status={t.status ?? ""} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={total ? (approved / total) * 100 : 0} className="h-1.5" />
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {approved}/{total}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden tabular-nums md:table-cell">{t.open_target_threads ?? 0}</TableCell>
                        <TableCell className="hidden max-w-72 lg:table-cell">
                          <ContributorList contributors={contributors.get(t.id!) ?? []} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/works/${work.id}/${t.language}/v/${t.version}`}>Abrir</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Original (inglês)</CardTitle>
            <CardDescription>Cada versão é imutável. Correções criam uma nova versão.</CardDescription>
            {permissions.canManageCatalog && (
              <CardAction>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/works/${work.id}/source/new`}>
                    <FilePlus2Icon /> Nova versão
                  </Link>
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="font-mono text-xs">v{s.version}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {s.notes ?? (s.version === 1 ? "Versão inicial" : "—")}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{s.segmentCount} segmentos</span>
                  <span className="hidden text-xs text-muted-foreground md:inline">{formatDateTime(s.created_at)}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/works/${work.id}/source/${s.version}`}>Ver</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function WorkSkeleton() {
  return (
    <div className="grid gap-6 p-6">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
