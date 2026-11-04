"use client"

import { useState } from "react"
import { CheckIcon, RotateCcwIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@euaggelion/ui/components/avatar"
import { Badge } from "@euaggelion/ui/components/badge"
import { Button } from "@euaggelion/ui/components/button"
import { Textarea } from "@euaggelion/ui/components/textarea"
import { initials } from "@euaggelion/ui/lib/format"
import { cn } from "@euaggelion/ui/lib/utils"

import type { CommentThread, Person } from "./types"

interface Props {
  thread: CommentThread
  people: Person[]
  active: boolean
  onSelect: () => void
  onReply: (body: string) => void
  onToggleResolved: () => void
}

export function ThreadCard({ thread, people, active, onSelect, onReply, onToggleResolved }: Props) {
  const [reply, setReply] = useState("")
  const resolved = thread.status === "resolved"
  const person = (id: string) => people.find((p) => p.id === id)

  return (
    <article
      id={`thread-${thread.id}`}
      onClick={onSelect}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-3.5 text-sm transition-colors",
        active ? "border-primary/50 ring-1 ring-primary/30" : "hover:border-foreground/20",
        resolved && !active && "opacity-60",
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Badge variant={thread.side === "target" ? "default" : "secondary"} className="h-4.5 text-[0.65rem]">
          {thread.side === "target" ? "Tradução" : "Original"}
        </Badge>
        {thread.side === "source" && <span className="text-[0.7rem] text-muted-foreground">não bloqueia</span>}
        {resolved && (
          <span className="ml-auto inline-flex items-center gap-1 text-[0.7rem] text-emerald-600 dark:text-emerald-400">
            <CheckIcon className="size-3" /> Resolvida
          </span>
        )}
      </div>

      <blockquote className="mb-3 line-clamp-2 border-l-2 border-primary/60 pl-2.5 text-[0.8rem] text-muted-foreground italic">
        {thread.quote}
      </blockquote>

      <ol className="space-y-3">
        {thread.messages.map((m) => {
          const author = person(m.authorId)
          return (
            <li key={m.id} className="flex gap-2.5">
              <Avatar className="size-6">
                <AvatarFallback className="text-[0.6rem]">{initials(author?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{author?.name}</span>
                  <span className="text-xs text-muted-foreground">{m.createdAt}</span>
                </div>
                <p className="mt-0.5 leading-relaxed text-foreground/90">{m.body}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {active && (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          {!resolved && (
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Responder… use @ para mencionar"
              className="min-h-16 resize-none text-sm"
            />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onToggleResolved}>
              {resolved ? (
                <>
                  <RotateCcwIcon /> Reabrir
                </>
              ) : (
                <>
                  <CheckIcon /> Resolver
                </>
              )}
            </Button>
            {!resolved && (
              <Button
                size="sm"
                disabled={!reply.trim()}
                onClick={() => {
                  onReply(reply.trim())
                  setReply("")
                }}
              >
                Responder
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
