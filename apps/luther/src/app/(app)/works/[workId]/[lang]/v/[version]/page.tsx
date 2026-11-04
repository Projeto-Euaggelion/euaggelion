import type { Metadata } from "next"

import { TranslationWorkspace } from "@/components/editor/translation-workspace"
import { people, segments, threads, work } from "@/lib/demo/immutability"

export const metadata: Metadata = { title: "Editor" }

// Etapa de layout: usa dados de demonstração. Na etapa 2 os params passam a
// carregar a obra, o idioma e a versão do Supabase.
export default function EditorPage() {
  return (
    <TranslationWorkspace work={work} people={people} initialSegments={segments} initialThreads={threads} />
  )
}
