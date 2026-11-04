import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { EUAGGELION_APP_IDS, type EuaggelionAppId } from "@euaggelion/db/apps"
import { Button } from "@euaggelion/ui/components/button"
import { EUAGGELION_APPS } from "@euaggelion/ui/shell/apps"

import { AuthLayout } from "@/components/auth-layout"

export const metadata: Metadata = { title: "Sem acesso" }

export default function NoAccessPage({ searchParams }: PageProps<"/sem-acesso">) {
  return (
    <Suspense fallback={<AuthLayout title="Sem acesso">{null}</AuthLayout>}>
      <NoAccess searchParams={searchParams} />
    </Suspense>
  )
}

async function NoAccess({ searchParams }: Pick<PageProps<"/sem-acesso">, "searchParams">) {
  const { app } = await searchParams
  const id = EUAGGELION_APP_IDS.includes(app as EuaggelionAppId) ? (app as EuaggelionAppId) : null
  const name = EUAGGELION_APPS.find((a) => a.id === id)?.name ?? "esta aplicação"

  return (
    <AuthLayout title="Sem acesso" description={`Sua conta não tem acesso a ${name}.`}>
      <p className="text-sm text-muted-foreground">
        O acesso a cada aplicação do Euaggelion é concedido pela equipe responsável. Se você deveria ter acesso, fale
        com um administrador.
      </p>
      <div className="mt-5 grid gap-2">
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="ghost" className="w-full">
            Entrar com outra conta
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
