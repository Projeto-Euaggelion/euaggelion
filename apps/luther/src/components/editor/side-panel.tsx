"use client"

import { useState } from "react"
import { HistoryIcon, MessageSquareIcon, SparklesIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import { ScrollArea } from "@euaggelion/ui/components/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@euaggelion/ui/components/tabs"
import { Textarea } from "@euaggelion/ui/components/textarea"
import { cn } from "@euaggelion/ui/lib/utils"

import { ThreadCard } from "./thread-card"
import type { Anchor, CommentThread, Person } from "./types"

type Filter = "open" | "resolved" | "all"

interface Props {
  tab: string
  onTabChange: (tab: string) => void
  threads: CommentThread[]
  people: Person[]
  activeThreadId: string | null
  draft: Anchor | null
  onSelectThread: (id: string) => void
  onCreateThread: (body: string) => void
  onCancelDraft: () => void
  onReply: (threadId: string, body: string) => void
  onToggleResolved: (threadId: string) => void
}

export function SidePanel(props: Props) {
  const { tab, onTabChange, threads, draft } = props
  const [filter, setFilter] = useState<Filter>("open")
  const [draftBody, setDraftBody] = useState("")

  const openCount = threads.filter((t) => t.status === "open").length
  const visible = threads.filter((t) => filter === "all" || t.status === filter)

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l bg-sidebar/40">
      <Tabs value={tab} onValueChange={onTabChange} className="flex h-full flex-col gap-0">
        <div className="flex h-14 items-center border-b px-3">
          <TabsList className="w-full">
            <TabsTrigger value="comments">
              <MessageSquareIcon /> Comentários
              {openCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[0.65rem] leading-4 text-primary-foreground">
                  {openCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <SparklesIcon /> IA
            </TabsTrigger>
            <TabsTrigger value="history">
              <HistoryIcon /> Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="comments" className="min-h-0 flex-1">
          <div className="flex items-center gap-1 px-3 pt-3">
            {(
              [
                ["open", "Abertas"],
                ["resolved", "Resolvidas"],
                ["all", "Todas"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  filter === value && "bg-muted text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <ScrollArea className="h-[calc(100%-2.5rem)]">
            <div className="space-y-3 p-3">
              {draft && (
                <div className="rounded-xl border border-primary/50 bg-card p-3.5 ring-1 ring-primary/30">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Novo comentário · {draft.side === "target" ? "Tradução" : "Original"}
                  </div>
                  <blockquote className="mb-3 line-clamp-3 border-l-2 border-primary/60 pl-2.5 text-[0.8rem] text-muted-foreground italic">
                    {draft.quote}
                  </blockquote>
                  <Textarea
                    autoFocus
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder="Escreva um comentário… use @ para mencionar"
                    className="min-h-20 resize-none text-sm"
                  />
                  {draft.side === "target" && (
                    <p className="mt-2 text-[0.7rem] text-muted-foreground">
                      Enquanto aberta, esta thread impede a aprovação do segmento.
                    </p>
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDraftBody("")
                        props.onCancelDraft()
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={!draftBody.trim()}
                      onClick={() => {
                        props.onCreateThread(draftBody.trim())
                        setDraftBody("")
                      }}
                    >
                      Comentar
                    </Button>
                  </div>
                </div>
              )}

              {visible.map((t) => (
                <ThreadCard
                  key={t.id}
                  thread={t}
                  people={props.people}
                  active={props.activeThreadId === t.id}
                  onSelect={() => props.onSelectThread(t.id)}
                  onReply={(body) => props.onReply(t.id, body)}
                  onToggleResolved={() => props.onToggleResolved(t.id)}
                />
              ))}

              {!draft && visible.length === 0 && (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma thread aqui. Selecione um trecho do texto para comentar.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="p-4">
          <EmptyPanel
            icon={SparklesIcon}
            title="Sugestões do DeepSeek"
            text="Para o segmento em foco: pedir outra sugestão, comparar com o texto atual e substituir. Chega na etapa 5."
          />
        </TabsContent>
        <TabsContent value="history" className="p-4">
          <EmptyPanel
            icon={HistoryIcon}
            title="Histórico do segmento"
            text="Revisões (IA ou humanas) e mudanças de etapa do segmento em foco."
          />
        </TabsContent>
      </Tabs>
    </aside>
  )
}

function EmptyPanel({ icon: Icon, title, text }: { icon: typeof SparklesIcon; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
      <Icon className="size-5 text-primary" />
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  )
}
