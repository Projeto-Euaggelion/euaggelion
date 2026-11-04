/**
 * @euaggelion/mdx
 *
 * Convenções de MDX compartilhadas entre os apps do Euaggelion:
 * - schema do frontmatter
 * - parser / segmentador (etapa 3)
 * - componentes MDX (Scripture, Quote, Note)
 */

export const WORK_TYPES = ["sermon", "article", "commentary"] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const SEGMENT_STAGES = [
  "original",
  "translation",
  "review",
  "discussion",
  "approved",
] as const;
export type SegmentStage = (typeof SEGMENT_STAGES)[number];

export const SOURCE_LANGUAGE = "en" as const;
