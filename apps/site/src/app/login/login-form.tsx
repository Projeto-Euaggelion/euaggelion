"use client"

import { useActionState } from "react"
import { Loader2Icon, MailIcon } from "lucide-react"

import { Button } from "@euaggelion/ui/components/button"
import { Input } from "@euaggelion/ui/components/input"
import { Label } from "@euaggelion/ui/components/label"
import { Separator } from "@euaggelion/ui/components/separator"

import { login, type LoginState } from "./actions"

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}

      <Button type="submit" name="intent" value="password" size="lg" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        Entrar
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" /> ou <Separator className="flex-1" />
      </div>

      <Button type="submit" name="intent" value="magic" variant="outline" size="lg" formNoValidate disabled={pending}>
        <MailIcon /> Receber link de acesso por e-mail
      </Button>
    </form>
  )
}
