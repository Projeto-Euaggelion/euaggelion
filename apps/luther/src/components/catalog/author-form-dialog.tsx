"use client"

import { useState } from "react"
import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react"
import { toast } from "@euaggelion/ui/components/sonner"

import { Alert, AlertDescription } from "@euaggelion/ui/components/alert"
import { Button } from "@euaggelion/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@euaggelion/ui/components/dialog"
import { Input } from "@euaggelion/ui/components/input"
import { Textarea } from "@euaggelion/ui/components/textarea"

import { createAuthor, updateAuthor } from "@/app/(app)/authors/actions"
import type { ActionState } from "@/lib/action-state"
import { slugify } from "@/lib/format"

import { useFormAction } from "@/lib/use-form-action"

import { FormField } from "./form-field"

export interface EditableAuthor {
  id: string
  name: string
  slug: string
  era: string
  bio: string
}

/** Cadastro/edição de autor (renderizado só para administradores). */
export function AuthorFormDialog({ author }: { author?: EditableAuthor }) {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending: pending } = useFormAction(async (prev: ActionState, formData: FormData) => {
    const result = await (author ? updateAuthor : createAuthor)(prev, formData)
    if (result.success) {
      toast.success(result.success)
      setOpen(false)
    }
    return result
  })
  const [name, setName] = useState(author?.name ?? "")
  const [slug, setSlug] = useState(author?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(!!author)

  const err = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {author ? (
          <Button variant="outline" size="sm">
            <PencilIcon /> Editar
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon /> Novo autor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{author ? "Editar autor" : "Novo autor"}</DialogTitle>
          </DialogHeader>
          {author && <input type="hidden" name="id" value={author.id} />}

          <FormField id="name" label="Nome" error={err.name}>
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!slugTouched) setSlug(slugify(e.target.value))
              }}
              placeholder="C. H. Spurgeon"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="slug" label="Slug" error={err.slug} hint="Usado no frontmatter (author)">
              <Input
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugTouched(true)
                }}
                className="font-mono text-xs"
              />
            </FormField>
            <FormField id="era" label="Época" error={err.era}>
              <Input name="era" defaultValue={author?.era} placeholder="1834–1892" />
            </FormField>
          </div>
          <FormField id="bio" label="Biografia" error={err.bio}>
            <Textarea name="bio" defaultValue={author?.bio} rows={5} />
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
