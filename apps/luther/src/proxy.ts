import type { NextRequest } from "next/server"

import { updateSession } from "@euaggelion/auth/proxy"

// Renova a sessão e exige login em todo o Luther (checagem otimista).
// O acesso à equipe de tradução e revisão é conferido no servidor pela DAL (layout).
export async function proxy(request: NextRequest) {
  return updateSession(request, { requireAuth: true })
}

export const config = {
  // Com basePath, os padrões são relativos a /luther; "/" cobre a raiz do app
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico).*)"],
}
