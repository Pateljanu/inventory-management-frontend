import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { useNow } from "@/hooks/use-now"
import { businessToday } from "@/lib/dates"
import { PRESET_LABELS, resolvePreset, type DateRange } from "@/lib/fy"
import { formatDate, formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { DASHBOARD_PRESETS, type DashboardPeriod } from "./period"

const span = (r: DateRange) =>
  r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`

/**
 * Quick periods plus a custom range, the resolved dates in words, what they are compared with,
 * and how fresh the numbers are (with a manual refresh).
 */
export function PeriodControl({
  period,
  comparison,
  onChange,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  period: DashboardPeriod
  comparison: DateRange
  onChange: (range: DateRange) => void
  updatedAt: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const now = useNow()
  const today = businessToday()

  return (
    <div className="flex max-w-full min-w-0 flex-col gap-2 lg:items-end">
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Period"
          className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
        >
          {DASHBOARD_PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={period.preset === id}
              onClick={() => onChange(resolvePreset(id, today, { clampToToday: true }))}
              className={cn(
                "h-9 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground md:h-8",
                period.preset === id && "bg-background text-foreground shadow-sm"
              )}
            >
              {PRESET_LABELS[id]}
            </button>
          ))}
        </div>
        <DateRangePicker
          from={period.from}
          to={period.to}
          clearable={false}
          onChange={(range) => range && onChange(range)}
        />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
        <span>
          {span(period)} · compared with {span(comparison)}
        </span>
        <span className="flex items-center gap-1">
          <span aria-live="polite">
            {updatedAt ? `Updated ${formatRelative(updatedAt, now)}` : "Loading…"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh the numbers"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn(refreshing && "animate-spin motion-reduce:animate-none")} />
          </Button>
        </span>
      </p>
    </div>
  )
}
