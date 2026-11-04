import type { SegmentStage } from "@euaggelion/mdx"

export const STAGE_META: Record<
  SegmentStage,
  { label: string; dot: string; badge: string }
> = {
  original: {
    label: "Original",
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  },
  translation: {
    label: "Tradução",
    dot: "bg-sky-500",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  review: {
    label: "Revisão",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  discussion: {
    label: "Em discussão",
    dot: "bg-violet-500",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  },
  approved: {
    label: "Aprovado",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
}

/** Transições permitidas pelo fluxo editorial (ver CLAUDE.md). */
export const STAGE_TRANSITIONS: Record<SegmentStage, SegmentStage[]> = {
  original: ["translation"],
  translation: ["review", "discussion"],
  review: ["approved", "translation", "discussion"],
  discussion: ["translation", "review"],
  approved: ["review"],
}
