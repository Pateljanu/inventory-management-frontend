import type { ReactNode } from "react"
import { DASH } from "@/lib/format"
import { cn } from "@/lib/utils"

export type KeyValue = { label: string; value: ReactNode; numeric?: boolean }

/** Label/value rows for detail cards and phone cards. Empty values show a dash. */
export function KeyValueList({
  items,
  columns = 1,
  className,
}: {
  items: KeyValue[]
  columns?: 1 | 2
  className?: string
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 text-sm", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className={cn("min-w-0 break-words", item.numeric && "tabular-nums")}>
            {item.value === undefined || item.value === null || item.value === "" ? (
              <span className="text-muted-foreground">{DASH}</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
