import { AppShell } from "@euaggelion/ui/shell/app-shell"

import { LutherSidebar } from "@/components/luther-sidebar"

// Usuário de demonstração até a etapa 2 (Supabase Auth).
const user = { name: "Você", email: "admin@euaggelion", role: "Admin" }

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell currentApp="luther" sidebar={<LutherSidebar />} user={user}>
      {children}
    </AppShell>
  )
}
