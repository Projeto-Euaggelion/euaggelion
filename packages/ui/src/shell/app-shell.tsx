"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@euaggelion/ui/components/sidebar"
import { cn } from "@euaggelion/ui/lib/utils"
import { EUAGGELION_APPS, type EuaggelionAppId } from "@euaggelion/ui/shell/apps"
import { NavUser, type ShellUser } from "@euaggelion/ui/shell/nav-user"

interface AppShellProps {
  /** App aberto: destacado no trilho. */
  currentApp: EuaggelionAppId
  /** Sidebar interna: navegação e funções do app aberto. */
  sidebar: React.ReactNode
  /** Conta logada (só dados de exibição). */
  user: ShellUser
  /** Apps que o usuário pode abrir, decididos no servidor. */
  apps: EuaggelionAppId[]
  children: React.ReactNode
}

/**
 * Shell comum a todas as aplicações do Euaggelion:
 * trilho externo (apps do projeto) + sidebar interna (navegação do app) + conteúdo.
 */
export function AppShell({ currentApp, sidebar, user, apps, children }: AppShellProps) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "320px" } as React.CSSProperties}>
      <Sidebar collapsible="icon" className="overflow-hidden *:data-[sidebar=sidebar]:flex-row">
        <AppRail currentApp={currentApp} user={user} apps={apps} />
        <Sidebar collapsible="none" className="hidden flex-1 md:flex">
          {sidebar}
        </Sidebar>
      </Sidebar>
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}

function AppRail({ currentApp, user, apps }: { currentApp: EuaggelionAppId; user: ShellUser; apps: EuaggelionAppId[] }) {
  const visible = EUAGGELION_APPS.filter((app) => apps.includes(app.id))
  return (
    <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
              <a href="/" aria-label="Projeto Euaggelion">
                <EuaggelionMark />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Euaggelion</span>
                  <span className="truncate text-xs">Projeto</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-auto w-6!" />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="px-1.5 md:px-0">
            <SidebarMenu>
              {visible.map((app) => {
                const soon = app.status === "soon"
                const active = app.id === currentApp
                return (
                  <SidebarMenuItem key={app.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={{
                        children: (
                          <div className="grid">
                            <span className="font-medium">{app.name}</span>
                            <span className="opacity-70">{soon ? "Em breve" : app.description}</span>
                          </div>
                        ),
                        hidden: false,
                      }}
                      className={cn(
                        "px-2.5 md:px-2",
                        active && "bg-primary/15! text-primary! [&_svg]:text-primary",
                        soon && "opacity-45",
                      )}
                    >
                      {/* Entre zonas a navegação é "hard": <a>, não <Link> */}
                      <a href={soon ? undefined : app.path} aria-disabled={soon || undefined}>
                        <app.icon />
                        <span>{app.name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

/** Marca provisória do Euaggelion (substituir pelo logotipo oficial). */
export function EuaggelionMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-serif text-lg leading-none font-semibold text-sidebar-primary-foreground",
        className,
      )}
    >
      ε
    </div>
  )
}
