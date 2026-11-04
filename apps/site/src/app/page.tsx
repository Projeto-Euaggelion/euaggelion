import { Suspense } from "react"

import { getAccessibleApps, getAccount } from "@euaggelion/auth/access"
import { Button } from "@euaggelion/ui/components/button"
import { EuaggelionMark } from "@euaggelion/ui/shell/app-shell"
import { EUAGGELION_APPS } from "@euaggelion/ui/shell/apps"

// Página provisória: o site público ainda será construído.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <EuaggelionMark />
          <span className="font-semibold">Projeto Euaggelion</span>
        </div>
        <Suspense fallback={null}>
          <AccountArea />
        </Suspense>
      </header>

      <section className="mt-24">
        <h1 className="text-4xl font-semibold tracking-tight">Estudo bíblico visual e interativo</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">O site público está em construção.</p>
      </section>

      <Suspense fallback={null}>
        <AppList />
      </Suspense>
    </main>
  )
}

async function AccountArea() {
  const account = await getAccount().catch(() => null)
  if (!account) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="/login">Entrar</a>
      </Button>
    )
  }
  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">{account.name}</span>
      <Button type="submit" variant="ghost" size="sm">
        Sair
      </Button>
    </form>
  )
}

async function AppList() {
  const allowed: string[] = await getAccessibleApps().catch(() => [])
  const apps = EUAGGELION_APPS.filter((a) => a.id !== "site" && allowed.includes(a.id))
  return (
    <section className="mt-16 grid gap-3 sm:grid-cols-2">
      {apps.map((app) => (
        <a
          key={app.id}
          href={app.status === "soon" ? undefined : app.path}
          aria-disabled={app.status === "soon" || undefined}
          className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <app.icon className="size-5 text-primary" />
          <div>
            <div className="font-medium">{app.name}</div>
            <div className="text-xs text-muted-foreground">{app.status === "soon" ? "Em breve" : app.description}</div>
          </div>
        </a>
      ))}
    </section>
  )
}
