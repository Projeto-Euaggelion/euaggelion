"use client"

import { BellIcon, LogOutIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback } from "@euaggelion/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@euaggelion/ui/components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@euaggelion/ui/components/sidebar"
import { initials } from "@euaggelion/ui/lib/format"

/** Dados de exibição da conta. Papéis e permissões nunca chegam ao client. */
export interface ShellUser {
  name: string
  email: string
}

/** Menu do usuário, comum a todos os apps (perfil, notificações, tema, sair). */
export function NavUser({ user }: { user: ShellUser }) {
  const { isMobile } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="md:h-8 md:p-0">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="font-normal">
              <div className="grid text-sm leading-tight">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <UserIcon /> Perfil
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon /> Preferências de notificação
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")}>
                {dark ? <SunIcon /> : <MoonIcon />}
                {dark ? "Modo claro" : "Modo escuro"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Logout único do Euaggelion: rota servida pela zona principal (apps/site) */}
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOutIcon /> Sair
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
