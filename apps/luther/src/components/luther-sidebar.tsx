"use client"

import Link from "next/link"
import {
  BellIcon,
  BookAIcon,
  ChevronRightIcon,
  HouseIcon,
  LibraryIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@euaggelion/ui/components/collapsible"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@euaggelion/ui/components/sidebar"
import { STAGE_META } from "@/lib/stages"

// Dados de navegação de demonstração: virão do Supabase na etapa 2.
const nav = [
  { title: "Início", href: "/", icon: HouseIcon },
  { title: "Notificações", href: "#", icon: BellIcon, badge: 2 },
  { title: "Obras", href: "#", icon: LibraryIcon, active: true },
  { title: "Glossário", href: "#", icon: BookAIcon },
  { title: "Colaboradores", href: "#", icon: UsersIcon },
]

const tasks = [
  { stage: "review", label: "Para revisar", count: 4 },
  { stage: "discussion", label: "Em discussão", count: 2 },
  { stage: "translation", label: "Para traduzir", count: 7 },
] as const

const pinned = ["A Imutabilidade de Deus", "Santidade"]

const authors = [
  {
    name: "C. H. Spurgeon",
    works: ["A Imutabilidade de Deus", "O Pecado da Incredulidade", "Um Apelo aos Pecadores"],
    open: true,
  },
  { name: "J. C. Ryle", works: ["Santidade", "O Dever dos Pais"] },
  { name: "P. E. Kretzmann", works: ["Comentário: 1 Crônicas"] },
]

const ACTIVE_WORK = "A Imutabilidade de Deus"

/** Sidebar interna do Luther: navegação e funções do app. */
export function LutherSidebar() {
  return (
    <>
      <SidebarHeader className="gap-3 p-4">
        <div>
          <div className="text-base font-semibold">Luther</div>
          <div className="text-xs text-muted-foreground">Tradução e revisão</div>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput placeholder="Buscar obras ou autores…" className="pl-8" />
        </div>
        <Button className="w-full">
          <PlusIcon /> Nova obra
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={item.active}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.badge && (
                  <SidebarMenuBadge className="rounded-full bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground">
                    {item.badge}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Minhas tarefas</SidebarGroupLabel>
          <SidebarMenu>
            {tasks.map((t) => (
              <SidebarMenuItem key={t.label}>
                <SidebarMenuButton>
                  <span className={`ml-1 size-2 rounded-full ${STAGE_META[t.stage].dot}`} />
                  <span>{t.label}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>{t.count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            <PinIcon className="mr-1.5 size-3" /> Fixadas
          </SidebarGroupLabel>
          <SidebarMenu>
            {pinned.map((w) => (
              <SidebarMenuItem key={w}>
                <SidebarMenuButton isActive={w === ACTIVE_WORK}>
                  <span className="truncate">{w}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Autores</SidebarGroupLabel>
          <SidebarMenu>
            {authors.map((a) => (
              <Collapsible key={a.name} asChild defaultOpen={a.open} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton>
                      <ChevronRightIcon className="transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      <span>{a.name}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <SidebarMenuBadge>{a.works.length}</SidebarMenuBadge>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {a.works.map((w) => (
                        <SidebarMenuSubItem key={w}>
                          <SidebarMenuSubButton href="#" isActive={w === ACTIVE_WORK}>
                            <span className="truncate">{w}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <SettingsIcon />
              <span>Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  )
}
