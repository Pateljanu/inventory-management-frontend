import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type RecordCardProps = {
  /** Identifier (name, PO number); rendered as the card's link or button by the caller. */
  title: ReactNode
  badge?: ReactNode
  /** Two or three key facts. */
  children?: ReactNode
  /** Date / counterparty line. */
  footer?: ReactNode
  /** Row menu at top right. */
  actions?: ReactNode
  onOpen?: () => void
  className?: string
}

/**
 * A table row on phones: identifier and status on top, key numbers in the middle, date and
 * counterparty at the bottom, menu at top right. The whole card opens the record.
 */
export function RecordCard({ title, badge, children, footer, actions, onOpen, className }: RecordCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm transition-colors duration-(--duration-fast)",
        onOpen && "active:bg-muted/50",
        className
      )}
      onClick={(e) => {
        if (!onOpen || (e.target as HTMLElement).closest("a,button,[role=menuitem]")) return
        onOpen()
      }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-base font-medium">{title}</div>
        {badge}
        {actions ? <div className="-mt-2 -mr-2">{actions}</div> : null}
      </div>
      {children}
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  )
}
