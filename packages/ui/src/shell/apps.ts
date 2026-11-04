/**
 * Apresentação das aplicações do Projeto Euaggelion no trilho de apps.
 * Ids, caminhos e regra de acesso vêm de @euaggelion/db/apps; quais apps cada
 * usuário pode abrir é decidido no servidor e chega ao shell como lista de ids.
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

import { EUAGGELION_APP_CONFIG, EUAGGELION_APP_IDS, type EuaggelionAppId } from "@euaggelion/db/apps"

export type { EuaggelionAppId }

export interface EuaggelionApp {
  id: EuaggelionAppId
  name: string
  description: string
  icon: LucideIcon
  path: string
  status: "active" | "soon"
}

const PRESENTATION: Record<EuaggelionAppId, { name: string; description: string; icon: LucideIcon }> = {
  site: { name: "Euaggelion", description: "Site público", icon: GlobeIcon },
  luther: { name: "Luther", description: "Tradução e revisão", icon: LanguagesIcon },
  commentary: { name: "Comentário bíblico", description: "Comentários clássicos", icon: MessageSquareQuoteIcon },
  reader: { name: "Leitor bíblico", description: "Leitura das Escrituras", icon: BookOpenTextIcon },
  dictionary: { name: "Dicionário", description: "Verbetes bíblicos", icon: LibraryBigIcon },
  chronology: { name: "Cronologia", description: "Linha do tempo bíblica", icon: HistoryIcon },
  atlas: { name: "Atlas", description: "Mapas bíblicos", icon: MapIcon },
}

export const EUAGGELION_APPS: EuaggelionApp[] = EUAGGELION_APP_IDS.map((id) => ({
  id,
  ...PRESENTATION[id],
  path: EUAGGELION_APP_CONFIG[id].path,
  status: EUAGGELION_APP_CONFIG[id].status,
}))
