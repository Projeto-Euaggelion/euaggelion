"use client"

import type { ComponentProps } from "react"

import { NativeSelect } from "@euaggelion/ui/components/native-select"
import { LUTHER_ROLES } from "@euaggelion/db/apps"

import { LUTHER_ROLE_DESCRIPTIONS, LUTHER_ROLE_LABELS } from "@/lib/format"

/** Seletor de papel do Luther, com a descrição de cada um. */
export function RoleSelect(props: ComponentProps<typeof NativeSelect>) {
  return (
    <NativeSelect className="w-full" {...props}>
      {LUTHER_ROLES.map((role) => (
        <option key={role} value={role}>
          {LUTHER_ROLE_LABELS[role]}: {LUTHER_ROLE_DESCRIPTIONS[role]}
        </option>
      ))}
    </NativeSelect>
  )
}
