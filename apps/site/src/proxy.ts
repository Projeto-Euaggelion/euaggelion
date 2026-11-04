import type { NextRequest } from "next/server"

import { updateSession } from "@euaggelion/auth/proxy"

// Renova a sessão em todas as rotas da zona principal (o login não é obrigatório aqui).
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Exclui assets e os caminhos servidos por outras zonas (cada zona tem o seu proxy)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|luther(?:/|$)).*)"],
}
