import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Button } from "@euaggelion/ui/components/button"
import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@euaggelion/ui/components/table"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { AuthorFormDialog } from "@/components/catalog/author-form-dialog"
import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { WorkStatusBadge } from "@/components/catalog/status-badges"
import { getLutherPermissions } from "@/lib/access"
import { getAuthor, listWorks } from "@/lib/data/catalog"
import { formatWorkDate, WORK_TYPE_LABELS, type WorkStatus } from "@/lib/format"

export const metadata: Metadata = { title: "Autor" }

export default function AuthorPage({ params }: PageProps<"/authors/[slug]">) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<Skeleton className="m-6 h-96" />}>
        <AuthorContent params={params} />
      </Suspense>
    </div>
  )
}

async function AuthorContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) notFound()
  const [{ works, total }, { canManageCatalog }] = await Promise.all([
    listWorks({ author: author.slug }),
    getLutherPermissions(),
  ])

  return (
    <>
      <AppHeader
        actions={
          canManageCatalog && (
            <AuthorFormDialog
              author={{ id: author.id, name: author.name, slug: author.slug, era: author.era ?? "", bio: author.bio ?? "" }}
            />
          )
        }
      >
        <PageBreadcrumb items={[{ label: "Autores", href: "/authors" }, { label: author.name }]} />
      </AppHeader>
      <div className="mx-auto grid w-full max-w-4xl gap-6 p-4 md:p-6">
        <section className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{author.name}</h1>
          {author.era && <p className="text-sm text-muted-foreground">{author.era}</p>}
          {author.bio && <p className="mt-2 max-w-3xl whitespace-pre-line">{author.bio}</p>}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              {total} {total === 1 ? "obra" : "obras"}
            </h2>
            {total > works.length && (
              <Button variant="link" size="sm" asChild>
                <Link href={`/works?author=${author.slug}`}>Ver todas</Link>
              </Button>
            )}
          </div>
          {works.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {works.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="max-w-96 font-medium">
                        <Link href={`/works/${w.id}`} className="block truncate hover:underline">
                          {w.title}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{WORK_TYPE_LABELS[w.type]}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatWorkDate(w.date_text) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <WorkStatusBadge status={w.status as WorkStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
