import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import type { AppPath } from "@/components/layout/nav"
import { EmptyState } from "./empty-state"

/** A record link that no longer resolves (typo, old link, or the record was removed). */
export function RecordNotFound({
  what,
  backTo,
  backLabel,
}: {
  what: string
  backTo: AppPath
  backLabel: string
}) {
  return (
    <EmptyState
      kind="no-results"
      title={`This ${what} doesn't exist`}
      description="The link may be old or mistyped."
      action={<Button render={<Link to={backTo} />}>{backLabel}</Button>}
    />
  )
}
