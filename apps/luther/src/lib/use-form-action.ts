"use client"

import { useActionState, useTransition, type FormEvent } from "react"

import { initialActionState, type ActionState } from "./action-state"

/**
 * Como `useActionState`, mas sem o reset automático do formulário que o React faz após uma
 * action passada em `<form action>`: se o servidor recusar os dados, o que a pessoa digitou
 * continua nos campos.
 */
export function useFormAction(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, dispatch, actionPending] = useActionState(action, initialActionState)
  const [transitionPending, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => dispatch(formData))
  }

  return { state, onSubmit, pending: actionPending || transitionPending }
}
