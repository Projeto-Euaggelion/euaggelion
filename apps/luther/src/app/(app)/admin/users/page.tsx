import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { UsersIcon } from "lucide-react"

import { Badge } from "@euaggelion/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@euaggelion/ui/components/card"
import { Skeleton } from "@euaggelion/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@euaggelion/ui/components/table"
import { AppHeader } from "@euaggelion/ui/shell/app-header"
import { cn } from "@euaggelion/ui/lib/utils"
import { LUTHER_ROLES } from "@euaggelion/db/apps"

import { EmptyState } from "@/components/catalog/empty-state"
import { PageBreadcrumb } from "@/components/catalog/page-breadcrumb"
import { InviteMemberDialog } from "@/components/team/invite-member-dialog"
import { MemberActions } from "@/components/team/member-actions"
import { requireLuther } from "@/lib/access"
import { listTeam, type MemberStatus } from "@/lib/data/team"
import { formatDateTime, LUTHER_ROLE_DESCRIPTIONS, LUTHER_ROLE_LABELS } from "@/lib/format"

export const metadata: Metadata = { title: "Equipe" }

export default function TeamPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<TeamSkeleton />}>
        <TeamContent />
      </Suspense>
    </div>
  )
}

/** Só administradores: para os demais papéis a rota não existe. */
async function TeamContent() {
  const { account, role } = await requireLuther()
  if (role !== "admin") notFound()
  const members = await listTeam()

  const counts = Object.fromEntries(
    LUTHER_ROLES.map((r) => [r, members.filter((m) => m.role === r && m.status !== "inactive").length]),
  )

  return (
    <>
      <AppHeader actions={<InviteMemberDialog />}>
        <PageBreadcrumb items={[{ label: "Administração" }, { label: "Equipe" }]} />
      </AppHeader>

      <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 p-4 md:p-6">
        <section className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Equipe do Luther</h1>
          <p className="text-muted-foreground">
            Quem pode traduzir, revisar e administrar. A conta vale para todo o Euaggelion; aqui você concede o acesso
            ao Luther.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {LUTHER_ROLES.map((r) => (
            <Card key={r} className="gap-1 py-4">
              <CardHeader className="px-4">
                <CardDescription>{ROLE_PLURALS[r]}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{counts[r]}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs text-muted-foreground">{LUTHER_ROLE_DESCRIPTIONS[r]}</CardContent>
            </Card>
          ))}
        </div>

        {members.length === 0 ? (
          <EmptyState icon={UsersIcon} title="Ninguém na equipe" description="Convide a primeira pessoa." />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="hidden md:table-cell">Último acesso</TableHead>
                  <TableHead className="hidden lg:table-cell">Na equipe desde</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isSelf = m.userId === account.id
                  return (
                    <TableRow key={m.userId} className={cn(m.status === "inactive" && "text-muted-foreground")}>
                      <TableCell>
                        <div className="font-medium">
                          {m.name}
                          {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </TableCell>
                      <TableCell>{LUTHER_ROLE_LABELS[m.role]}</TableCell>
                      <TableCell>
                        <MemberStatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {m.lastSignInAt ? formatDateTime(m.lastSignInAt) : "Nunca"}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatDateTime(m.since)}
                        {m.grantedBy && <div>por {m.grantedBy}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        <MemberActions
                          member={{ userId: m.userId, name: m.name, email: m.email, role: m.role, status: m.status }}
                          isSelf={isSelf}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  )
}

const ROLE_PLURALS: Record<(typeof LUTHER_ROLES)[number], string> = {
  admin: "Administradores",
  translator: "Tradutores",
  reviewer: "Revisores",
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Ativo",
  invited: "Convite pendente",
  inactive: "Desativado",
}

function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "active" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        status === "invited" && "border-amber-500/50 text-amber-600 dark:text-amber-400",
        status === "inactive" && "text-muted-foreground",
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function TeamSkeleton() {
  return (
    <div className="grid gap-6 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
