"use client"

import { BoldIcon, BookOpenIcon, ItalicIcon, LinkIcon, MessageSquarePlusIcon, SuperscriptIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import { Separator } from "@euaggelion/ui/components/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@euaggelion/ui/components/tooltip"

import type { Side } from "./types"

interface Props {
  rect: DOMRect
  side: Side
  onComment: () => void
}

const FORMAT_TOOLS = [
  { icon: BoldIcon, label: "Negrito" },
  { icon: ItalicIcon, label: "Itálico" },
  { icon: LinkIcon, label: "Link" },
  { icon: SuperscriptIcon, label: "Nota de rodapé" },
  { icon: BookOpenIcon, label: "Citação bíblica (<Scripture>)" },
]

/**
 * Barra flutuante exibida sobre a seleção de texto.
 * "Comentário" é a ação principal; a formatação (só o que o MDX representa)
 * aparece apenas na tradução, já que o original é imutável.
 */
export function SelectionToolbar({ rect, side, onComment }: Props) {
  const top = Math.max(8, rect.top - 48)
  const left = rect.left + rect.width / 2

  return (
    <div
      role="toolbar"
      aria-label="Ações da seleção"
      onMouseDown={(e) => e.preventDefault()} // mantém a seleção ao clicar
      style={{ top, left }}
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-white/10 bg-neutral-900/95 p-1 text-neutral-100 shadow-xl backdrop-blur animate-in fade-in-0 zoom-in-95"
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={onComment}
        className="gap-1.5 text-neutral-100 hover:bg-white/10 hover:text-white"
      >
        <MessageSquarePlusIcon className="text-primary" />
        Comentário
      </Button>
      {side === "target" && (
        <>
          <Separator orientation="vertical" className="mx-1 h-5 bg-white/15" />
          {FORMAT_TOOLS.map(({ icon: Icon, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled
                    aria-label={label}
                    className="text-neutral-300 hover:bg-white/10"
                  >
                    <Icon />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{label} · disponível com o editor (etapa 5)</TooltipContent>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  )
}
