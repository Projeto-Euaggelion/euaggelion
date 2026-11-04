import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { MdxImportForm } from "@/components/catalog/mdx-import-form"
import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { requireLuther } from "@/lib/access"
import { getSourceVersions, getSourceVersion, getWork } from "@/lib/data/catalog"
import { isUuid } from "@/lib/ids"

import { createSourceVersion, previewMdx } from "../../../actions"

export const metadata: Metadata = { title: "Nova versão do original" }

export default function NewSourceVersionPage({ params }: PageProps<"/works/[workId]/source/new">) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<Skeleton className="m-6 h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  )
}

async function Content({ params }: { params: Promise<{ workId: string }> }) {
  await requireLuther(["admin"])
  const { workId } = await params
  if (!isUuid(workId)) notFound()
  const work = await getWork(workId)
  if (!work) notFound()
  const [latest] = await getSourceVersions(workId)
  const current = latest ? await getSourceVersion(workId, latest.version) : null

  return (
    <>
      <AppHeader>
        <PageBreadcrumb
          items={[
            { label: "Obras", href: "/works" },
            { label: work.title, href: `/works/${workId}` },
            { label: "Nova versão do original" },
          ]}
        />
      </AppHeader>
      <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:p-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Cada versão do original é imutável. Ao criar a v{(latest?.version ?? 0) + 1}, as traduções baseadas na versão
          anterior passam a aparecer como desatualizadas. Uma nova versão da tradução reaproveita os segmentos que não
          mudaram.
        </p>
        <MdxImportForm
          mode="version"
          action={createSourceVersion}
          preview={previewMdx}
          workId={workId}
          initialMdx={current?.mdx ?? ""}
        />
      </div>
    </>
  )
}
