"use client"

import { LanguagesIcon, Loader2Icon } from "lucide-react"

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
import { NativeSelect } from "@euaggelion/ui/components/native-select"

import { startTranslation } from "@/app/(app)/works/actions"
import { TARGET_LANGUAGES } from "@/lib/format"

import { useFormAction } from "@/lib/use-form-action"

import { FormField } from "./form-field"

/**
 * Inicia uma tradução (ou a próxima versão dela). Renderizado só para administradores e
 * revisores; a ação confere o papel de novo no servidor.
 */
export function StartTranslationDialog({
  workId,
  existingLanguages,
  busyLanguages,
}: {
  workId: string
  /** Idiomas que já têm alguma versão (permitem copiar a anterior). */
  existingLanguages: string[]
  /** Idiomas com versão em andamento (não podem começar outra). */
  busyLanguages: string[]
}) {
  const { state, onSubmit, pending: pending } = useFormAction(startTranslation)
  const available = Object.entries(TARGET_LANGUAGES).filter(([code]) => !busyLanguages.includes(code))

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" disabled={available.length === 0}>
          <LanguagesIcon /> Nova tradução
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nova versão da tradução</DialogTitle>
            <DialogDescription>
              Cada obra tem no máximo uma tradução por idioma. Retraduzir cria uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="workId" value={workId} />
          <FormField id="language" label="Idioma">
            <NativeSelect name="language" className="w-full">
              {available.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                  {existingLanguages.includes(code) ? " (nova versão)" : ""}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            id="mode"
            label="Ponto de partida"
            hint="Copiar reaproveita os segmentos cujo original não mudou (voltam para revisão)."
          >
            <NativeSelect name="mode" defaultValue="copy" className="w-full">
              <option value="copy">Copiar a versão anterior</option>
              <option value="blank">Começar do zero</option>
            </NativeSelect>
          </FormField>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Criar e abrir o editor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
