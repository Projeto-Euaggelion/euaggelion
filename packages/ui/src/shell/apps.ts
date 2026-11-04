/**
 * Registro das aplicações do Projeto Euaggelion.
 * Alimenta o trilho externo (seletor de apps), compartilhado por todos os apps.
 * As URLs de cada app vêm de variáveis NEXT_PUBLIC_APP_URL_<ID> (ver .env.example);
 * sem variável, o app aparece como "em breve" ou aponta para "#".
 */
import {
  BookOpenTextIcon,
  GlobeIcon,
  HistoryIcon,
  LanguagesIcon,
  LibraryBigIcon,
  MapIcon,
  MessageSquareQuoteIcon,
  type LucideIcon,
} from "lucide-react"

export type EuaggelionAppId =
  | "site"
  | "luther"
  | "commentary"
  | "reader"
  | "dictionary"
  | "chronology"
  | "atlas"

export interface EuaggelionApp {
  id: EuaggelionAppId
  name: string
  description: string
  icon: LucideIcon
  status: "active" | "soon"
  /** Apps internos exigem login (ex.: Luther). */
  internal?: boolean
}

export const EUAGGELION_APPS: EuaggelionApp[] = [
  { id: "site", name: "Euaggelion", description: "Site público", icon: GlobeIcon, status: "soon" },
  { id: "luther", name: "Luther", description: "Tradução e revisão", icon: LanguagesIcon, status: "active", internal: true },
  { id: "commentary", name: "Comentário bíblico", description: "Comentários clássicos", icon: MessageSquareQuoteIcon, status: "soon" },
  { id: "reader", name: "Leitor bíblico", description: "Leitura das Escrituras", icon: BookOpenTextIcon, status: "soon" },
  { id: "dictionary", name: "Dicionário", description: "Verbetes bíblicos", icon: LibraryBigIcon, status: "soon" },
  { id: "chronology", name: "Cronologia", description: "Linha do tempo bíblica", icon: HistoryIcon, status: "soon" },
  { id: "atlas", name: "Atlas", description: "Mapas bíblicos", icon: MapIcon, status: "soon" },
]

const APP_URLS: Partial<Record<EuaggelionAppId, string | undefined>> = {
  site: process.env.NEXT_PUBLIC_APP_URL_SITE,
  luther: process.env.NEXT_PUBLIC_APP_URL_LUTHER,
  commentary: process.env.NEXT_PUBLIC_APP_URL_COMMENTARY,
  reader: process.env.NEXT_PUBLIC_APP_URL_READER,
  dictionary: process.env.NEXT_PUBLIC_APP_URL_DICTIONARY,
  chronology: process.env.NEXT_PUBLIC_APP_URL_CHRONOLOGY,
  atlas: process.env.NEXT_PUBLIC_APP_URL_ATLAS,
}

export function appUrl(id: EuaggelionAppId, current: EuaggelionAppId) {
  if (id === current) return "/"
  return APP_URLS[id] ?? "#"
}
