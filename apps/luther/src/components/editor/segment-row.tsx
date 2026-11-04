"use client"

import type { SegmentStage } from "@euaggelion/mdx"
import { CheckIcon, ChevronDownIcon, MessageSquareIcon, SparklesIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@euaggelion/ui/components/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@euaggelion/ui/components/tooltip"
import { STAGE_META, STAGE_TRANSITIONS } from "@/lib/stages"
import { cn } from "@euaggelion/ui/lib/utils"

import { HighlightedText, type Mark } from "./highlighted-text"
import type { Segment } from "./types"

interface Props {
  segment: Segment
  sourceMarks: Mark[]
  targetMarks: Mark[]
  openTargetThreads: number
  openSourceThreads: number
  activeMarkId: string | null
  focused: boolean
  onMarkClick: (id: string) => void
  onStageChange: (stage: SegmentStage) => void
}

const KIND_STYLE: Record<Segment["kind"], string> = {
  title: "text-2xl font-semibold tracking-tight",
  heading: "text-lg font-semibold",
  description: "text-[0.95rem] text-muted-foreground",
  paragraph: "text-[0.95rem] leading-7",
  quote: "border-l-2 border-primary/50 pl-4 text-[0.95rem] italic leading-7",
  footnote: "text-sm leading-6",
}

const KIND_LABEL: Partial<Record<Segment["kind"], string>> = {
  title: "Título",
  description: "Descrição",
  quote: "Citação",
  footnote: "Nota",
}

export function SegmentRow({
  segment,
  sourceMarks,
  targetMarks,
  openTargetThreads,
  openSourceThreads,
  activeMarkId,
  focused,
  onMarkClick,
  onStageChange,
}: Props) {
  const meta = STAGE_META[segment.stage]
  const blockedApproval = openTargetThreads > 0
  const canApprove = STAGE_TRANSITIONS[segment.stage].includes("approved")

  return (
    <section
      id={`seg-${segment.id}`}
      data-focused={focused || undefined}
      className="group/segment relative grid grid-cols-2 gap-x-10 rounded-xl px-6 py-5 transition-colors hover:bg-muted/30 data-focused:bg-muted/40"
    >
      {/* Indicador de etapa na margem */}
      <span aria-hidden className={cn("absolute top-6 left-2 size-1.5 rounded-full", meta.dot)} />

      {/* Original (EN) */}
      <div className="min-w-0">
        {KIND_LABEL[segment.kind] && (
          <div className="mb-1.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
            {KIND_LABEL[segment.kind]}
          </div>
        )}
        <HighlightedText
          text={segment.source}
          segmentId={segment.id}
          side="source"
          marks={sourceMarks}
          activeId={activeMarkId}
          onMarkClick={onMarkClick}
          className={cn(KIND_STYLE[segment.kind], "text-foreground/65")}
        />
        {openSourceThreads > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquareIcon className="size-3" />
            {openSourceThreads} no original · sem pendência
          </div>
        )}
      </div>

      {/* Tradução */}
      <div className="min-w-0">
        {KIND_LABEL[segment.kind] && <div className="mb-1.5 h-[1.05rem]" />}
        {segment.target ? (
          <HighlightedText
            text={segment.target}
            segmentId={segment.id}
            side="target"
            marks={targetMarks}
            activeId={activeMarkId}
            onMarkClick={onMarkClick}
            className={KIND_STYLE[segment.kind]}
          />
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Ainda não traduzido.
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="xs" variant="outline" disabled>
                    <SparklesIcon /> Traduzir com IA
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>DeepSeek · etapa 5</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Barra do segmento */}
        <div className="mt-3 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  meta.badge,
                )}
              >
                {meta.label}
                <ChevronDownIcon className="size-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Mover para</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STAGE_TRANSITIONS[segment.stage].map((stage) => {
                const disabled = stage === "approved" && blockedApproval
                return (
                  <DropdownMenuItem key={stage} disabled={disabled} onSelect={() => onStageChange(stage)}>
                    <span className={cn("size-2 rounded-full", STAGE_META[stage].dot)} />
                    {STAGE_META[stage].label}
                    {disabled && <span className="ml-auto text-xs text-muted-foreground">threads abertas</span>}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {openTargetThreads > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <MessageSquareIcon className="size-3" />
              {openTargetThreads} {openTargetThreads === 1 ? "thread aberta" : "threads abertas"}
            </span>
          )}

          {canApprove && (
            <div className="ml-auto opacity-0 transition-opacity group-hover/segment:opacity-100 group-data-focused/segment:opacity-100">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={blockedApproval}
                      onClick={() => onStageChange("approved")}
                    >
                      <CheckIcon /> Aprovar
                    </Button>
                  </span>
                </TooltipTrigger>
                {blockedApproval && (
                  <TooltipContent>Resolva as threads abertas na tradução para aprovar</TooltipContent>
                )}
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
