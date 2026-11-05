"use client"

import { useState, useTransition } from "react"
import { Loader2Icon, MailIcon, MoreHorizontalIcon, PencilIcon, UserCheckIcon, UserXIcon } from "lucide-react"
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
} from "@euaggelion/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@euaggelion/ui/components/dropdown-menu"
import { Input } from "@euaggelion/ui/components/input"
import type { LutherRole } from "@euaggelion/db/apps"

import { resendInvite, setMemberActive, updateMember } from "@/app/(app)/admin/users/actions"
import { FormField } from "@/components/catalog/form-field"
import type { ActionState } from "@/lib/action-state"
import { useFormAction } from "@/lib/use-form-action"

import { RoleSelect } from "./role-select"

interface Member {
  userId: string
  name: string
  email: string
  role: LutherRole
  status: "active" | "invited" | "inactive"
}

/** Menu de ações de uma pessoa da equipe (renderizado só para administradores). */
export function MemberActions({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [dialog, setDialog] = useState<"edit" | "deactivate" | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<ActionState>, after?: () => void) {
    startTransition(async () => {
      const result = await action()
      if (result.error) toast.error(result.error)
      else if (result.success) {
        toast.success(result.success)
        after?.()
      }
    })
  }

  const inactive = member.status === "inactive"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Ações para ${member.name}`} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <MoreHorizontalIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <PencilIcon /> Editar
          </DropdownMenuItem>
          {member.status === "invited" && (
            <DropdownMenuItem onSelect={() => run(() => resendInvite(member.userId))}>
              <MailIcon /> Reenviar convite
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              {inactive ? (
                <DropdownMenuItem onSelect={() => run(() => setMemberActive(member.userId, true))}>
                  <UserCheckIcon /> Reativar acesso
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog("deactivate")}>
                  <UserXIcon /> Desativar acesso
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditMemberDialog member={member} isSelf={isSelf} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />

      <Dialog open={dialog === "deactivate"} onOpenChange={(o) => setDialog(o ? "deactivate" : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar o acesso de {member.name}?</DialogTitle>
            <DialogDescription>
              A pessoa deixa de abrir o Luther, mas a conta no Euaggelion e o histórico (traduções, revisões,
              comentários e créditos) continuam. Dá para reativar depois.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => setMemberActive(member.userId, false), () => setDialog(null))}
            >
              {pending && <Loader2Icon className="animate-spin" />} Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditMemberDialog({
  member,
  isSelf,
  open,
  onOpenChange,
}: {
  member: Member
  isSelf: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, onSubmit, pending } = useFormAction(async (prev: ActionState, formData: FormData) => {
    const result = await updateMember(prev, formData)
    if (result.success) {
      toast.success(result.success)
      onOpenChange(false)
    }
    return result
  })
  const err = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Editar {member.name}</DialogTitle>
            <DialogDescription>{member.email}</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="userId" value={member.userId} />
          <FormField id={`name-${member.userId}`} label="Nome" error={err.name} hint="Aparece nos créditos das traduções.">
            <Input name="name" defaultValue={member.name} required />
          </FormField>
          {isSelf ? (
            <>
              <input type="hidden" name="role" value={member.role} />
              <p className="text-xs text-muted-foreground">
                Você não pode mudar o seu próprio papel. Outro administrador pode fazer isso.
              </p>
            </>
          ) : (
            <FormField id={`role-${member.userId}`} label="Papel" error={err.role}>
              <RoleSelect name="role" defaultValue={member.role} />
            </FormField>
          )}
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
