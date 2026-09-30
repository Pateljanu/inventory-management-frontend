import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** Exactly one primary action at top right. */
  primaryAction?: ReactNode
  /** At most three secondary actions, shown before the primary one. */
  secondaryActions?: ReactNode
  /** Extra content under the title row (e.g. period control). */
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div data-slot="page-header" className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {primaryAction || secondaryActions ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
