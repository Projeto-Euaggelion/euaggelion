/**
 * Aplicações do Projeto Euaggelion: espelha o enum public.euaggelion_app.
 * Todas são servidas no mesmo domínio (multi-zones), cada uma no seu caminho.
 *
 * access:
 *   - "public":  aberto a qualquer visitante
 *   - "members": exige membership ativa em app_memberships (checada só no servidor)
 */
export const EUAGGELION_APP_IDS = [
  "site",
  "luther",
  "commentary",
  "reader",
  "dictionary",
  "chronology",
  "atlas",
] as const

export type EuaggelionAppId = (typeof EUAGGELION_APP_IDS)[number]

export interface EuaggelionAppConfig {
  id: EuaggelionAppId
  /** Caminho no domínio do Euaggelion (basePath da zona). */
  path: string
  access: "public" | "members"
  status: "active" | "soon"
}

export const EUAGGELION_APP_CONFIG: Record<EuaggelionAppId, EuaggelionAppConfig> = {
  site: { id: "site", path: "/", access: "public", status: "active" },
  luther: { id: "luther", path: "/luther", access: "members", status: "active" },
  commentary: { id: "commentary", path: "/comentario", access: "public", status: "soon" },
  reader: { id: "reader", path: "/leitor", access: "public", status: "soon" },
  dictionary: { id: "dictionary", path: "/dicionario", access: "public", status: "soon" },
  chronology: { id: "chronology", path: "/cronologia", access: "public", status: "soon" },
  atlas: { id: "atlas", path: "/atlas", access: "public", status: "soon" },
}

/** Papéis do Luther (espelha public.luther_role). */
export const LUTHER_ROLES = ["admin", "translator", "reviewer"] as const
export type LutherRole = (typeof LUTHER_ROLES)[number]
