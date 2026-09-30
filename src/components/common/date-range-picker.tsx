import { useState } from "react"
import { CalendarRange, X } from "lucide-react"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { businessToday, dateOnlyToLocalDate, localDateToDateOnly } from "@/lib/dates"
import {
  describeRange,
  matchPreset,
  PRESET_IDS,
  PRESET_LABELS,
  resolvePreset,
  type DateRange,
} from "@/lib/fy"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type DateRangePickerProps = {
  from?: string
  to?: string
  /** undefined = all dates. */
  onChange: (range: DateRange | undefined) => void
  /** Allow "All dates" (lists) or always require a range (reports). */
  clearable?: boolean
  className?: string
}

/**
 * Indian date presets (FY runs April-March) with the resolved dates shown next to each label,
 * plus a range calendar for anything else.
 */
export function DateRangePicker({ from, to, onChange, clearable = true, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DayPickerRange | undefined>()
  const today = businessToday()
  const active = matchPreset({ from, to })

  const apply = (range: DateRange | undefined) => {
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next)
          setDraft(from && to ? { from: dateOnlyToLocalDate(from), to: dateOnlyToLocalDate(to) } : undefined)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "h-11 justify-start gap-2 px-3 font-normal tabular-nums md:h-9",
              (from || to) && "border-primary bg-accent text-accent-foreground",
              className
            )}
          />
        }
      >
        <CalendarRange className="text-muted-foreground" />
        <span className="truncate">{describeRange(from, to)}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <div className="flex flex-col md:flex-row">
          <ul className="grid grid-cols-2 gap-1 border-b p-2 md:flex md:w-64 md:flex-col md:border-r md:border-b-0">
            {PRESET_IDS.map((id) => {
              const range = resolvePreset(id, today)
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => apply(range)}
                    aria-pressed={active === id}
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted pointer-coarse:min-h-11",
                      active === id && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    {PRESET_LABELS[id]}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {range.from === range.to
                        ? formatDate(range.from)
                        : `${formatDate(range.from)} – ${formatDate(range.to)}`}
                    </span>
                  </button>
                </li>
              )
            })}
            {clearable ? (
              <li className="col-span-2">
                <button
                  type="button"
                  onClick={() => apply(undefined)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted pointer-coarse:min-h-11"
                >
                  <X className="size-4" /> All dates
                </button>
              </li>
            ) : null}
          </ul>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              weekStartsOn={1}
              defaultMonth={draft?.from ?? dateOnlyToLocalDate(today)}
              className="[--cell-size:--spacing(9)] md:[--cell-size:--spacing(8)]"
            />
            <div className="flex items-center justify-between gap-2 border-t p-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {draft?.from
                  ? `${formatDate(localDateToDateOnly(draft.from))} – ${draft.to ? formatDate(localDateToDateOnly(draft.to)) : "…"}`
                  : "Pick a start and end day"}
              </span>
              <Button
                size="sm"
                disabled={!draft?.from}
                onClick={() =>
                  draft?.from &&
                  apply({
                    from: localDateToDateOnly(draft.from),
                    to: localDateToDateOnly(draft.to ?? draft.from),
                  })
                }
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
