"use client"

import { useState, useTransition } from "react"
import { AlertTriangleIcon, FileUpIcon, Loader2Icon, ScanTextIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@euaggelion/ui/components/alert"
import { Badge } from "@euaggelion/ui/components/badge"
import { Button } from "@euaggelion/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@euaggelion/ui/components/card"
import { Input } from "@euaggelion/ui/components/input"
import { Label } from "@euaggelion/ui/components/label"
import { Textarea } from "@euaggelion/ui/components/textarea"

import type { MdxPreview } from "@/app/(app)/works/actions"
import type { ActionState } from "@/lib/action-state"
import { SEGMENT_KIND_LABELS as KIND_LABELS, WORK_TYPE_LABELS } from "@/lib/format"

import { useFormAction } from "@/lib/use-form-action"

import { FormField } from "./form-field"


const EXAMPLE = `---
title: The Immutability of God
author: c-h-spurgeon
type: sermon
description: A sermon on Malachi 3:6.
date: 1855-01-07
source: https://www.spurgeon.org/
credits: Public domain
---

It has been said by some one that "the proper study of mankind is man."
`

interface Props {
  mode: "work" | "version"
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  preview: (mdx: string, options?: { checkAuthor?: boolean }) => Promise<MdxPreview>
  workId?: string
  initialMdx?: string
}

/**
 * Colar/enviar MDX → pré-visualizar a segmentação → gravar.
 * A pré-visualização e a gravação rodam no servidor (parser em @euaggelion/mdx).
 */
export function MdxImportForm({ mode, action, preview, workId, initialMdx = "" }: Props) {
  const [mdx, setMdx] = useState(initialMdx)
  const [result, setResult] = useState<MdxPreview | null>(null)
  const [previewedMdx, setPreviewedMdx] = useState<string | null>(null)
  const [isPreviewing, startPreview] = useTransition()
  const { state, onSubmit, pending: isSaving } = useFormAction(action)

  const stale = previewedMdx !== null && previewedMdx !== mdx
  const canSave = !!result && !result.error && !!result.metadata && result.segments.length > 0 && !stale

  function runPreview() {
    startPreview(async () => {
      const r = await preview(mdx, { checkAuthor: mode === "work" })
      setResult(r)
      setPreviewedMdx(mdx)
    })
  }

  async function loadFile(file: File | undefined) {
    if (!file) return
    setMdx(await file.text())
    setResult(null)
    setPreviewedMdx(null)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Texto em MDX</CardTitle>
          <CardDescription>
            Cole o texto ou envie um arquivo <code>.mdx</code>/<code>.md</code>. O frontmatter precisa de{" "}
            <code>title</code>, <code>author</code> (slug) e <code>type</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea
            aria-label="Texto em MDX"
            value={mdx}
            onChange={(e) => setMdx(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            className="min-h-[28rem] font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" asChild>
              <label className="cursor-pointer">
                <FileUpIcon /> Enviar arquivo
                <input
                  type="file"
                  accept=".mdx,.md,text/markdown"
                  className="sr-only"
                  onChange={(e) => loadFile(e.target.files?.[0])}
                />
              </label>
            </Button>
            <Button type="button" onClick={runPreview} disabled={!mdx.trim() || isPreviewing}>
              {isPreviewing ? <Loader2Icon className="animate-spin" /> : <ScanTextIcon />}
              Pré-visualizar segmentação
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        {!result && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              A pré-visualização mostra os metadados e os segmentos que serão traduzidos.
            </CardContent>
          </Card>
        )}

        {result?.error && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Não foi possível ler o texto</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}

        {result && !result.error && (
          <>
            {result.issues.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertTitle>Corrija antes de gravar</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {result.issues.map((issue, i) => (
                      <li key={i}>
                        {issue.path && <code className="mr-1">{issue.path}</code>}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {result.metadata && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{result.metadata.title}</CardTitle>
                  {result.metadata.description && <CardDescription>{result.metadata.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Autor</dt>
                    <dd>
                      {result.author?.name ?? result.metadata.author}
                      {result.author && !result.author.name && (
                        <Badge variant="outline" className="ml-2">
                          novo
                        </Badge>
                      )}
                    </dd>
                    <dt className="text-muted-foreground">Tipo</dt>
                    <dd>{WORK_TYPE_LABELS[result.metadata.type as keyof typeof WORK_TYPE_LABELS]}</dd>
                    {mode === "work" && (
                      <>
                        <dt className="text-muted-foreground">Slug</dt>
                        <dd className="font-mono text-xs leading-5">{result.metadata.slug}</dd>
                      </>
                    )}
                    {result.metadata.date && (
                      <>
                        <dt className="text-muted-foreground">Data</dt>
                        <dd>{result.metadata.date}</dd>
                      </>
                    )}
                    {result.metadata.source && (
                      <>
                        <dt className="text-muted-foreground">Fonte</dt>
                        <dd className="truncate">{result.metadata.source}</dd>
                      </>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{result.segments.length} segmentos</CardTitle>
                <CardDescription>Cada segmento é traduzido e revisado separadamente.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="max-h-[22rem] divide-y overflow-y-auto rounded-md border text-sm">
                  {result.segments.map((s) => (
                    <li key={s.position} className="flex gap-3 px-3 py-2">
                      <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                        {s.position + 1}
                      </span>
                      <Badge variant="secondary" className="h-5 shrink-0">
                        {KIND_LABELS[s.kind]}
                      </Badge>
                      <span className="line-clamp-3 whitespace-pre-line">{s.text}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </>
        )}

        <form onSubmit={onSubmit} className="grid gap-3">
          <input type="hidden" name="mdx" value={mdx} />
          {workId && <input type="hidden" name="workId" value={workId} />}

          {mode === "work" && result?.author && !result.author.name && (
            <FormField
              id="authorName"
              label={`Nome do novo autor (${result.author.slug})`}
              error={state.fieldErrors?.authorName}
              hint="O autor ainda não está cadastrado e será criado com este nome."
            >
              <Input name="authorName" placeholder="C. H. Spurgeon" required />
            </FormField>
          )}

          {mode === "version" && (
            <div className="grid gap-1.5">
              <Label htmlFor="notes">O que mudou nesta versão</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Correção de digitação no 3º parágrafo"
                aria-invalid={!!state.fieldErrors?.notes || undefined}
              />
              {state.fieldErrors?.notes && <p className="text-xs text-destructive">{state.fieldErrors.notes}</p>}
            </div>
          )}

          {state.error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {stale && (
            <p className="text-xs text-muted-foreground">O texto mudou desde a pré-visualização. Pré-visualize de novo.</p>
          )}

          <Button type="submit" disabled={!canSave || isSaving} className="justify-self-end">
            {isSaving && <Loader2Icon className="animate-spin" />}
            {mode === "work" ? "Criar obra" : "Criar nova versão do original"}
          </Button>
        </form>
      </div>
    </div>
  )
}
