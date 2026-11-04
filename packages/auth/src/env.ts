import "server-only"

/**
 * Variáveis de ambiente do servidor. Lidas sob demanda para que o build não
 * dependa delas; a ausência só falha quando a autenticação é de fato usada.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

export const authEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  publishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  /** Chave secreta (service role): só no servidor, nunca com prefixo NEXT_PUBLIC_. */
  secretKey: () => required("SUPABASE_SECRET_KEY"),
  /** Origem pública do Euaggelion (ex.: https://euaggelion.org). Usada para sair do basePath das zonas. */
  publicOrigin: () => process.env.EUAGGELION_URL ?? "http://localhost:3000",
}
