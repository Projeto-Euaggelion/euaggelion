import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { UsersIcon } from "lucide-react"

import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@euaggelion/ui/components/table"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { AuthorFormDialog } from "@/components/catalog/author-form-dialog"
import { EmptyState } from "@/components/catalog/empty-state"
import { getLutherPermissions } from "@/lib/access"
import { listAuthors } from "@/lib/data/catalog"

export const metadata: Metadata = { title: "Autores" }

export default function AuthorsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader
        actions={
          <Suspense>
            <NewAuthorButton />
          </Suspense>
        }
      >
        <span className="text-sm font-medium">Autores</span>
      </AppHeader>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-6">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AuthorsTable />
        </Suspense>
      </div>
    </div>
  )
}

async function NewAuthorButton() {
  const { canManageCatalog } = await getLutherPermissions()
  return canManageCatalog ? <AuthorFormDialog /> : null
}

async function AuthorsTable() {
  const authors = await listAuthors()
  if (authors.length === 0) {
    return <EmptyState icon={UsersIcon} title="Nenhum autor" description="Cadastre um autor ou importe uma obra." />
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Época</TableHead>
            <TableHead className="text-right">Obras</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {authors.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">
                <Link href={`/authors/${a.slug}`} className="hover:underline">
                  {a.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{a.era ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{a.workCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
