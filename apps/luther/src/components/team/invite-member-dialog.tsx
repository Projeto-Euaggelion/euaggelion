"use client"

import { useState } from "react"
import { Loader2Icon, UserPlusIcon } from "lucide-react"
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

import { inviteMember } from "@/app/(app)/admin/users/actions"
import { FormField } from "@/components/catalog/form-field"
import type { ActionState } from "@/lib/action-state"
import { useFormAction } from "@/lib/use-form-action"

import { RoleSelect } from "./role-select"

/** Convite para a equipe (renderizado só para administradores; a ação confere de novo). */
export function InviteMemberDialog() {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const { state, onSubmit, pending } = useFormAction(async (prev: ActionState, formData: FormData) => {
    const result = await inviteMember(prev, formData)
    if (result.success) {
      toast.success(result.success)
      setOpen(false)
      setFormKey((k) => k + 1)
    }
    return result
  })
  const err = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlusIcon /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form key={formKey} onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Convidar para a equipe</DialogTitle>
            <DialogDescription>
              A pessoa recebe um e-mail com o link de acesso. Se já tiver conta no Euaggelion, só ganha o acesso ao
              Luther.
            </DialogDescription>
          </DialogHeader>
          <FormField id="invite-email" label="E-mail" error={err.email}>
            <Input name="email" type="email" autoComplete="off" placeholder="nome@exemplo.com" required />
          </FormField>
          <FormField id="invite-name" label="Nome" error={err.name} hint="Aparece nos créditos das traduções.">
            <Input name="name" autoComplete="off" required />
          </FormField>
          <FormField id="invite-role" label="Papel" error={err.role}>
            <RoleSelect name="role" defaultValue="translator" />
          </FormField>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
