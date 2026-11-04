import { Suspense } from "react"

import { getAccessibleApps } from "@euaggelion/auth/access"
import { AppShell } from "@euaggelion/ui/shell/app-shell"

import { LutherSidebar } from "@/components/luther-sidebar"
import { getLutherPermissions, requireLuther } from "@/lib/access"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <LutherGate>{children}</LutherGate>
    </Suspense>
  )
}

/** Confere no servidor se a conta faz parte da equipe do Luther antes de renderizar qualquer coisa. */
async function LutherGate({ children }: { children: React.ReactNode }) {
  const { account } = await requireLuther()
  const [apps, { canManageCatalog }] = await Promise.all([getAccessibleApps(), getLutherPermissions()])

  return (
    <AppShell
      currentApp="luther"
      sidebar={<LutherSidebar canManageCatalog={canManageCatalog} />}
      user={{ name: account.name, email: account.email }}
      apps={apps}
    >
      {children}
    </AppShell>
  )
}
