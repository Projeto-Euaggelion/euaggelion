"use client"

import { useState } from "react"
import { Loader2Icon, PencilIcon } from "lucide-react"
import { toast } from "@euaggelion/ui/components/sonner"

import { Alert, AlertDescription } from "@euaggelion/ui/components/alert"
import { Button } from "@euaggelion/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@euaggelion/ui/components/dialog"
import { Input } from "@euaggelion/ui/components/input"
import { NativeSelect } from "@euaggelion/ui/components/native-select"
import { WORK_TYPES } from "@euaggelion/mdx/schema"

import { updateWork } from "@/app/(app)/works/actions"
import type { ActionState } from "@/lib/action-state"
import { WORK_STATUSES, WORK_STATUS_LABELS, WORK_TYPE_LABELS } from "@/lib/format"

import { useFormAction } from "@/lib/use-form-action"

import { FormField } from "./form-field"

export interface EditableWork {
  id: string
  authorId: string
  type: string
  status: string
  slug: string
  date: string
  source: string
  credits: string
}

/** Edição dos metadados da obra (o botão só é renderizado para administradores). */
export function WorkEditDialog({ work, authors }: { work: EditableWork; authors: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending: pending } = useFormAction(async (prev: ActionState, formData: FormData) => {
    const result = await updateWork(prev, formData)
    if (result.success) {
      toast.success(result.success)
      setOpen(false)
    }
    return result
  })

  const err = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilIcon /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Editar metadados</DialogTitle>
            <DialogDescription>
              Título e descrição vêm do original: para alterá-los, crie uma nova versão do original.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={work.id} />

          <FormField id="authorId" label="Autor" error={err.authorId}>
            <NativeSelect name="authorId" defaultValue={work.authorId} className="w-full">
              {authors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="type" label="Tipo" error={err.type}>
              <NativeSelect name="type" defaultValue={work.type} className="w-full">
                {WORK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="status" label="Status" error={err.status}>
              <NativeSelect name="status" defaultValue={work.status} className="w-full">
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {WORK_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="slug" label="Slug" error={err.slug}>
              <Input name="slug" defaultValue={work.slug} className="font-mono text-xs" />
            </FormField>
            <FormField id="date" label="Data" error={err.date} hint="AAAA, AAAA-MM ou AAAA-MM-DD">
              <Input name="date" defaultValue={work.date} placeholder="1855-01-07" />
            </FormField>
          </div>
          <FormField id="source" label="Fonte" error={err.source}>
            <Input name="source" defaultValue={work.source} />
          </FormField>
          <FormField id="credits" label="Créditos (edição em inglês)" error={err.credits}>
            <Input name="credits" defaultValue={work.credits} />
          </FormField>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
