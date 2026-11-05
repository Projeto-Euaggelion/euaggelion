import type { Contributor } from "@/lib/data/catalog"

const ROLE_LABELS: Record<Contributor["roles"][number], string> = {
  translator: "tradução",
  reviewer: "revisão",
}

/** "Davi (tradução), Rute (tradução e revisão)" */
export function ContributorList({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length === 0) return <span className="text-muted-foreground">—</span>
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-0.5 text-sm">
      {contributors.map((c, i) => (
        <li key={`${c.name}-${i}`}>
          {c.name}
          <span className="text-muted-foreground"> ({c.roles.map((r) => ROLE_LABELS[r]).join(" e ")})</span>
          {i < contributors.length - 1 && <span className="text-muted-foreground">,</span>}
        </li>
      ))}
    </ul>
  )
}
