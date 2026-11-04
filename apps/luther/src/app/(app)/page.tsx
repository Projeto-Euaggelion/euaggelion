import Link from "next/link"

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
          O dashboard de tarefas chega com o Supabase (etapa 2). Por enquanto, veja o layout do editor com dados de
          demonstração.
        </p>
        <Button asChild>
          <Link href="/works/spurgeon-0001/pt-BR/v/1">Abrir editor de exemplo</Link>
        </Button>
      </div>
    </div>
  )
}
