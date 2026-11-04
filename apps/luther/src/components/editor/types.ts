import type { SegmentStage } from "@euaggelion/mdx"

export type SegmentKind = "title" | "description" | "paragraph" | "quote" | "heading" | "footnote"
export type Side = "source" | "target"

/** Pessoa exibida no editor. Só dados de exibição: papéis nunca chegam ao client. */
export interface Person {
  id: string
  name: string
}

export interface Segment {
  id: string
  kind: SegmentKind
  source: string
  target: string
  stage: SegmentStage
}

export interface Anchor {
  segmentId: string
  side: Side
  quote: string
  start: number
  end: number
}

export interface CommentMessage {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export interface CommentThread extends Anchor {
  id: string
  status: "open" | "resolved"
  messages: CommentMessage[]
}

export interface WorkHeader {
  id: string
  title: string
  author: string
  type: string
  date: string
  source: string
  language: string
  version: number
}
