import type { ReactNode } from "react"
import { Inbox, SearchX, CircleCheck, type LucideIcon } from "lucide-react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

/*
 * Three kinds of empty state, each with one way forward:
 *  first-use  - nothing recorded yet ("Record your first purchase")
 *  no-results - filters hide everything ("Clear filters")
 *  all-done   - a work queue is empty ("No orders waiting")
 */
type Kind = "first-use" | "no-results" | "all-done"

const ICONS: Record<Kind, LucideIcon> = { "first-use": Inbox, "no-results": SearchX, "all-done": CircleCheck }

type EmptyStateProps = {
  kind?: Kind
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  className?: string
}

export function EmptyState({
  kind = "first-use",
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  const Icon = icon ?? ICONS[kind]
  return (
    <Empty className={cn("border py-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={kind === "all-done" ? "bg-success/12 text-success" : undefined}>
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
