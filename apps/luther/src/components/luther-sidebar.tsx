"use client"

import Form from "next/form"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookAIcon, HouseIcon, LibraryIcon, PlusIcon, SearchIcon, SettingsIcon, ShieldIcon, UsersIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@euaggelion/ui/components/sidebar"

const nav = [
  { title: "Início", href: "/", icon: HouseIcon, exact: true },
  { title: "Obras", href: "/works", icon: LibraryIcon },
  { title: "Autores", href: "/authors", icon: UsersIcon },
]

const adminNav = [{ title: "Equipe", href: "/admin/users", icon: ShieldIcon }]

const soon = [{ title: "Glossário", icon: BookAIcon }]

/**
 * Sidebar interna do Luther: navegação e funções do app.
 * `canManageCatalog` e `canManageTeam` são calculados no servidor (o papel não chega ao client);
 * as páginas e ações conferem o papel de novo.
 */
export function LutherSidebar({ canManageCatalog, canManageTeam }: { canManageCatalog: boolean; canManageTeam: boolean }) {
  const pathname = usePathname()
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <SidebarHeader className="gap-3 p-4">
        <div>
          <div className="text-base font-semibold">Luther</div>
          <div className="text-xs text-muted-foreground">Tradução e revisão</div>
        </div>
        <Form action="/works" className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput name="q" placeholder="Buscar obras…" aria-label="Buscar obras" className="pl-8" />
        </Form>
        {canManageCatalog && (
          <Button className="w-full" asChild>
            <Link href="/works/new">
              <PlusIcon /> Nova obra
            </Link>
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.href, item.exact)}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {canManageTeam && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarMenu>
              {adminNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Em breve</SidebarGroupLabel>
          <SidebarMenu>
            {soon.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton disabled aria-disabled className="opacity-60">
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled aria-disabled className="opacity-60">
              <SettingsIcon />
              <span>Configurações</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  )
}
