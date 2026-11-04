import { EuaggelionMark } from "@euaggelion/ui/shell/app-shell"

/** Moldura das telas de autenticação (login, sem acesso). */
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <EuaggelionMark className="size-11 text-2xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Uma única conta para todas as aplicações do Projeto Euaggelion.
        </p>
      </div>
    </main>
  )
}
