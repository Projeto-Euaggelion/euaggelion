import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Badge } from "@euaggelion/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@euaggelion/ui/components/card"
import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { getSourceSegments, getSourceVersion, getWork } from "@/lib/data/catalog"
import { formatDateTime, SEGMENT_KIND_LABELS } from "@/lib/format"
import { isUuid } from "@/lib/ids"

export const metadata: Metadata = { title: "Original" }

export default function SourceVersionPage({ params }: PageProps<"/works/[workId]/source/[version]">) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<Skeleton className="m-6 h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: Promise<{ workId: string; version: string }> }) {
  const { workId, version: versionParam } = await params
  const version = Number(versionParam)
  if (!isUuid(workId) || !Number.isInteger(version) || version < 1) notFound()
  const [work, source] = await Promise.all([getWork(workId), getSourceVersion(workId, version)])
  if (!work || !source) notFound()
  const segments = await getSourceSegments(source.id)

  return (
    <>
      <AppHeader>
        <PageBreadcrumb
          items={[
            { label: "Obras", href: "/works" },
            { label: work.title, href: `/works/${workId}` },
            { label: `Original v${version}` },
          ]}
        />
      </AppHeader>
      <div className="mx-auto grid w-full max-w-4xl gap-4 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Original · v{version}</CardTitle>
            <CardDescription>
              {formatDateTime(source.created_at)}
              {source.notes && ` · ${source.notes}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y rounded-md border text-sm">
              {segments.map((s) => (
                <li key={s.position} className="flex gap-3 px-3 py-2">
                  <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                    {s.position + 1}
                  </span>
                  <Badge variant="secondary" className="h-5 shrink-0">
                    {SEGMENT_KIND_LABELS[s.kind]}
                  </Badge>
                  <span className="whitespace-pre-line">{s.text}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">MDX completo</summary>
          <pre className="overflow-x-auto border-t p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {source.mdx}
          </pre>
        </details>
      </div>
    </>
  )
}
