import * as React from "react"

import { Separator } from "@euaggelion/ui/components/separator"
import { SidebarTrigger } from "@euaggelion/ui/components/sidebar"
import { cn } from "@euaggelion/ui/lib/utils"

/** Cabeçalho padrão da área de conteúdo: gatilho da sidebar + breadcrumb/título + ações. */
export function AppHeader({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex h-14 shrink-0 items-center gap-2 border-b px-4", className)}>
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-auto" />
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {actions && <div className="ml-auto flex items-center gap-3">{actions}</div>}
    </header>
  )
}
