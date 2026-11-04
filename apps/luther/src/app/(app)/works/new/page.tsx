import type { Metadata } from "next"
import { Suspense } from "react"

import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { MdxImportForm } from "@/components/catalog/mdx-import-form"
import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { requireLuther } from "@/lib/access"

import { createWork, previewMdx } from "../actions"

export const metadata: Metadata = { title: "Nova obra" }

export default function NewWorkPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader>
        <PageBreadcrumb items={[{ label: "Obras", href: "/works" }, { label: "Nova obra" }]} />
      </AppHeader>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Suspense>
          <AdminOnly>
            <MdxImportForm mode="work" action={createWork} preview={previewMdx} />
          </AdminOnly>
        </Suspense>
      </div>
    </div>
  )
}

/** Só administradores importam obras (quem não é vai para /sem-acesso). */
async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireLuther(["admin"])
  return children
}
