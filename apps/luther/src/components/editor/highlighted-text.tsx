import { cn } from "@euaggelion/ui/lib/utils"

import { ANCHOR_ROOT } from "./anchor"
import type { Side } from "./types"

export interface Mark {
  id: string
  start: number
  end: number
  resolved?: boolean
}

interface Props {
  text: string
  segmentId: string
  side: Side
  marks: Mark[]
  activeId: string | null
  onMarkClick: (id: string) => void
  className?: string
}

/** Texto do segmento com os trechos comentados destacados. */
export function HighlightedText({ text, segmentId, side, marks, activeId, onMarkClick, className }: Props) {
  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < cursor || mark.start < 0 || mark.end > text.length) continue // sobreposição/âncora inválida
    if (mark.start > cursor) parts.push(text.slice(cursor, mark.start))
    parts.push(
      <mark
        key={mark.id}
        data-thread={mark.id}
        onClick={(e) => {
          e.stopPropagation()
          onMarkClick(mark.id)
        }}
        className={cn(
          "cursor-pointer rounded-[3px] bg-comment-mark text-inherit decoration-primary/70 decoration-2 underline-offset-4 transition-colors",
          activeId === mark.id && "bg-comment-mark-active underline",
          mark.resolved && activeId !== mark.id && "bg-transparent underline decoration-dotted decoration-muted-foreground/50",
        )}
      >
        {text.slice(mark.start, mark.end)}
      </mark>,
    )
    cursor = mark.end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))

  return (
    <div
      {...{ [ANCHOR_ROOT]: "" }}
      data-segment-id={segmentId}
      data-side={side}
      className={cn("whitespace-pre-line", className)}
    >
      {parts}
    </div>
  )
}
