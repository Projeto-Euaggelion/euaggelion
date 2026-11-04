import "server-only"

import { requireAppAccess } from "@euaggelion/auth/access"
import type { LutherRole } from "@euaggelion/db/apps"

/**
 * Acesso ao Luther (somente servidor). Use em layouts/páginas, Server Actions e
 * Route Handlers. O papel nunca é repassado ao client: derive aqui o que a UI
 * precisa (ex.: `canApprove`) e revalide em cada ação.
 */
export function requireLuther(roles?: LutherRole[]) {
  return requireAppAccess("luther", { roles })
}

/**
 * Permissões da conta atual no Luther, já reduzidas a booleanos para a UI decidir o que mostrar.
 * Cada ação revalida o papel no servidor; isto só esconde botões que não funcionariam.
 */
export async function getLutherPermissions() {
  const { role } = await requireLuther()
  return {
    canManageCatalog: role === "admin",
    canStartTranslation: role === "admin" || role === "reviewer",
  }
}
