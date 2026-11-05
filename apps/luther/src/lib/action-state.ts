/** Estado devolvido pelas Server Actions de formulário (useActionState). */
export interface ActionState {
  error?: string
  fieldErrors?: Record<string, string>
  success?: string
}

export const initialActionState: ActionState = {}

/** Mensagem amigável para erros do Postgres/PostgREST. */
export function databaseErrorMessage(error: { code?: string; message: string; details?: string | null }): string {
  switch (error.code) {
    case "23505":
      if (error.message.includes("works_author_id_slug_key")) return "Já existe uma obra deste autor com esse slug."
      if (error.message.includes("authors_slug_key")) return "Já existe um autor com esse slug."
      return "Registro duplicado."
    case "23514":
      if (error.message.includes("administrador ativo")) return "O Luther precisa de ao menos um administrador ativo."
      return "Os dados não atendem às regras do banco."
    case "23503":
      return "Este registro está em uso e não pode ser removido."
    case "42501":
      return "Você não tem permissão para esta ação."
    default:
      return error.message
  }
}
