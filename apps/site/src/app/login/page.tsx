import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { getAccount } from "@euaggelion/auth/access"
import { safeNextPath } from "@euaggelion/auth/redirect"

import { AuthLayout } from "@/components/auth-layout"

import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Entrar" }

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthLayout title="Entrar no Euaggelion" description="Use sua conta do Projeto Euaggelion.">
      <Suspense fallback={<div className="h-72" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  )
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/")

  // Já logado: segue direto (o app de destino confere o acesso no servidor)
  if (await getAccount().catch(() => null)) redirect(next)

  return <LoginForm next={next} />
}
