import { Badge } from "@euaggelion/ui/components/badge"
import { cn } from "@euaggelion/ui/lib/utils"

import { VERSION_STATUS_LABELS, WORK_STATUS_LABELS, type WorkStatus } from "@/lib/format"

export function WorkStatusBadge({ status }: { status: WorkStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "active" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
        status === "archived" && "text-muted-foreground",
      )}
    >
      {WORK_STATUS_LABELS[status]}
    </Badge>
  )
}

export function VersionStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "published" ? "default" : "outline"}>{VERSION_STATUS_LABELS[status] ?? status}</Badge>
  )
}
