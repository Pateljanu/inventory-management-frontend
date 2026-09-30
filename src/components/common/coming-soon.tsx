import type { LucideIcon } from "lucide-react"
import { PageHeader } from "./page-header"
import { EmptyState } from "./empty-state"

/** Temporary page body for screens scheduled in a later build phase. */
export function ComingSoon({
  title,
  description,
  phase,
  icon,
}: {
  title: string
  description: string
  phase: number
  icon: LucideIcon
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title={`${title} arrives in phase ${phase}`}
        description="The navigation, login and backend connection are ready. This screen is built next."
      />
    </>
  )
}
