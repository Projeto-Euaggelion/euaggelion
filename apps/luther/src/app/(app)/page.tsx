import Link from "next/link"
import { LibraryIcon, UsersIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

export default function DashboardPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader>
        <span className="text-sm font-medium">Início</span>
      </AppHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Luther</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          O painel de tarefas (segmentos para traduzir e revisar, menções) chega com o fluxo de etapas. Por enquanto,
          comece pelas obras.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/works">
              <LibraryIcon /> Obras
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/authors">
              <UsersIcon /> Autores
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
