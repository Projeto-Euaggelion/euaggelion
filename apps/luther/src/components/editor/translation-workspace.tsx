"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SegmentStage } from "@euaggelion/mdx"
import { CloudCheckIcon, ExternalLinkIcon } from "lucide-react"
import { toast } from "@euaggelion/ui/components/sonner"

import { Badge } from "@euaggelion/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@euaggelion/ui/components/breadcrumb"
import { Button } from "@euaggelion/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@euaggelion/ui/components/tooltip"
import { AppHeader } from "@euaggelion/ui/shell/app-header"

import { STAGE_META } from "@/lib/stages"

import { anchorFromSelection } from "./anchor"
import type { Mark } from "./highlighted-text"
import { SegmentRow } from "./segment-row"
import { SelectionToolbar } from "./selection-toolbar"
import { SidePanel } from "./side-panel"
import type { Anchor, CommentThread, Person, Segment, WorkHeader } from "./types"

interface Props {
  work: WorkHeader
  people: Person[]
  initialSegments: Segment[]
  initialThreads: CommentThread[]
}

const DRAFT_ID = "__draft__"

export function TranslationWorkspace({ work, people, initialSegments, initialThreads }: Props) {
  const [segments, setSegments] = useState(initialSegments)
  const [threads, setThreads] = useState(initialThreads)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [selection, setSelection] = useState<(Anchor & { rect: DOMRect }) | null>(null)
  const [draft, setDraft] = useState<Anchor | null>(null)
  const [tab, setTab] = useState("comments")

  // Seleção de texto → barra flutuante
  useEffect(() => {
    const onMouseUp = () => {
      // aguarda o navegador finalizar a seleção
      requestAnimationFrame(() => setSelection(anchorFromSelection(window.getSelection())))
    }
    const onSelectionChange = () => {
      if (window.getSelection()?.isCollapsed) setSelection(null)
    }
    const onScroll = () => setSelection(null)
    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("selectionchange", onSelectionChange)
    document.addEventListener("scroll", onScroll, true)
    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("selectionchange", onSelectionChange)
      document.removeEventListener("scroll", onScroll, true)
    }
  }, [])

  const startComment = useCallback(() => {
    if (!selection) return
    setDraft({
      segmentId: selection.segmentId,
      side: selection.side,
      quote: selection.quote,
      start: selection.start,
      end: selection.end,
    })
    setActiveThreadId(DRAFT_ID)
    setTab("comments")
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [selection])

  const selectThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setTab("comments")
    const thread = threads.find((t) => t.id === id)
    document.getElementById(`seg-${thread?.segmentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    document.getElementById(`thread-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [threads])

  const marksFor = (segmentId: string, side: "source" | "target"): Mark[] => {
    const marks: Mark[] = threads
      .filter((t) => t.segmentId === segmentId && t.side === side)
      .map((t) => ({ id: t.id, start: t.start, end: t.end, resolved: t.status === "resolved" }))
    if (draft && draft.segmentId === segmentId && draft.side === side) {
      marks.push({ id: DRAFT_ID, start: draft.start, end: draft.end })
    }
    return marks
  }

  const openThreads = (segmentId: string, side: "source" | "target") =>
    threads.filter((t) => t.segmentId === segmentId && t.side === side && t.status === "open").length

  const changeStage = (segmentId: string, stage: SegmentStage) => {
    if (stage === "approved" && openThreads(segmentId, "target") > 0) {
      toast.error("Resolva as threads abertas na tradução antes de aprovar.")
      return
    }
    setSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, stage } : s)))
  }

  // Progresso e pendências da versão
  const stats = useMemo(() => {
    const byStage = Object.fromEntries(
      Object.keys(STAGE_META).map((k) => [k, segments.filter((s) => s.stage === k).length]),
    ) as Record<SegmentStage, number>
    const blockingThreads = threads.filter((t) => t.side === "target" && t.status === "open").length
    const pending = segments.length - byStage.approved
    return { byStage, blockingThreads, pending, approvedPct: Math.round((byStage.approved / segments.length) * 100) }
  }, [segments, threads])

  const canComplete = stats.pending === 0 && stats.blockingThreads === 0
  const focusedSegmentId =
    activeThreadId === DRAFT_ID ? draft?.segmentId : threads.find((t) => t.id === activeThreadId)?.segmentId
  const title = segments.find((s) => s.kind === "title")

  return (
    <div className="flex h-svh min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho */}
        <AppHeader
          actions={
            <>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <CloudCheckIcon className="size-4 text-primary" /> Salvo há 3 min
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" disabled={!canComplete}>
                      Concluir tradução
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canComplete && (
                  <TooltipContent className="max-w-60">
                    {stats.pending > 0 && <div>{stats.pending} segmento(s) ainda não aprovado(s)</div>}
                    {stats.blockingThreads > 0 && <div>{stats.blockingThreads} thread(s) aberta(s) na tradução</div>}
                  </TooltipContent>
                )}
              </Tooltip>
            </>
          }
        >
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem className="hidden lg:block">
                <BreadcrumbLink href="#">Obras</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden lg:block" />
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">{work.author}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">{work.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Badge variant="outline" className="ml-2 font-mono text-[0.7rem]">
            {work.language} · v{work.version}
          </Badge>

        </AppHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 pt-10 pb-24">
            {/* Identificação da obra */}
            <div className="px-6">
              <h1 className="text-3xl font-semibold tracking-tight">{title?.target || work.title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {work.author} · {work.type} · {work.date} ·{" "}
                <a href={`http://www.${work.source}`} className="inline-flex items-center gap-1 hover:text-foreground">
                  fonte <ExternalLinkIcon className="size-3" />
                </a>
              </p>

              {/* Progresso */}
              <div className="mt-6 rounded-xl border bg-card p-4">
                <div className="mb-2.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{stats.approvedPct}% aprovado</span>
                  <span className="text-xs text-muted-foreground">{segments.length} segmentos</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {(Object.keys(STAGE_META) as SegmentStage[])
                    .slice()
                    .reverse()
                    .map((stage) =>
                      stats.byStage[stage] ? (
                        <div
                          key={stage}
                          className={STAGE_META[stage].dot}
                          style={{ width: `${(stats.byStage[stage] / segments.length) * 100}%` }}
                        />
                      ) : null,
                    )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {(Object.keys(STAGE_META) as SegmentStage[]).map((stage) => (
                    <span key={stage} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`size-2 rounded-full ${STAGE_META[stage].dot}`} />
                      {STAGE_META[stage].label} <span className="text-foreground">{stats.byStage[stage]}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cabeçalho das colunas */}
            <div className="sticky top-0 z-10 mt-8 grid grid-cols-2 gap-x-10 border-b bg-background/95 px-6 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
              <span>Original · EN</span>
              <span>Tradução · {work.language}</span>
            </div>

            <div className="mt-2 space-y-1">
              {segments.map((segment) => (
                <SegmentRow
                  key={segment.id}
                  segment={segment}
                  sourceMarks={marksFor(segment.id, "source")}
                  targetMarks={marksFor(segment.id, "target")}
                  openSourceThreads={openThreads(segment.id, "source")}
                  openTargetThreads={openThreads(segment.id, "target")}
                  activeMarkId={activeThreadId}
                  focused={focusedSegmentId === segment.id}
                  onMarkClick={(id) => (id === DRAFT_ID ? setActiveThreadId(DRAFT_ID) : selectThread(id))}
                  onStageChange={(stage) => changeStage(segment.id, stage)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <SidePanel
        tab={tab}
        onTabChange={setTab}
        threads={threads}
        people={people}
        activeThreadId={activeThreadId}
        draft={draft}
        onSelectThread={selectThread}
        onCancelDraft={() => {
          setDraft(null)
          setActiveThreadId(null)
        }}
        onCreateThread={(body) => {
          if (!draft) return
          const id = `t-${Date.now()}`
          setThreads((prev) => [
            { ...draft, id, status: "open", messages: [{ id: `m-${Date.now()}`, authorId: "me", body, createdAt: "agora" }] },
            ...prev,
          ])
          setDraft(null)
          setActiveThreadId(id)
        }}
        onReply={(threadId, body) =>
          setThreads((prev) =>
            prev.map((t) =>
              t.id === threadId
                ? { ...t, messages: [...t.messages, { id: `m-${Date.now()}`, authorId: "me", body, createdAt: "agora" }] }
                : t,
            ),
          )
        }
        onToggleResolved={(threadId) =>
          setThreads((prev) =>
            prev.map((t) =>
              t.id === threadId ? { ...t, status: t.status === "open" ? "resolved" : "open" } : t,
            ),
          )
        }
      />

      {selection && <SelectionToolbar rect={selection.rect} side={selection.side} onComment={startComment} />}
    </div>
  )
}
