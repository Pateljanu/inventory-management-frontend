import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addDays, businessToday, dateOnlyToLocalDate, localDateToDateOnly, type DateOnly } from "@/lib/dates"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type DateInputProps = {
  id?: string
  /** "YYYY-MM-DD" or "" when empty. */
  value: string
  onChange: (value: DateOnly) => void
  onBlur?: () => void
  /** Latest selectable day (e.g. today: records can't be dated in the future). */
  max?: DateOnly
  min?: DateOnly
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/**
 * Business date picker. Shows DD/MM/YYYY, sends "YYYY-MM-DD", and offers one-tap Today /
 * Yesterday because most records are dated one of those.
 */
export function DateInput({ id, value, onChange, onBlur, max, min, className, ...aria }: DateInputProps) {
  const [open, setOpen] = useState(false)
  const today = businessToday()
  const selected = value ? dateOnlyToLocalDate(value) : undefined

  const pick = (next: DateOnly) => {
    onChange(next)
    setOpen(false)
    onBlur?.()
  }

  const disabled = [
    ...(max ? [{ after: dateOnlyToLocalDate(max) }] : []),
    ...(min ? [{ before: dateOnlyToLocalDate(min) }] : []),
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full justify-start gap-2 px-3 font-normal tabular-nums md:h-9 md:w-44",
              !value && "text-muted-foreground",
              aria["aria-invalid"] && "border-destructive ring-3 ring-destructive/20",
              className
            )}
            {...aria}
          />
        }
      >
        <CalendarDays className="text-muted-foreground" />
        {value ? formatDate(value) : "DD/MM/YYYY"}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex gap-2 border-b p-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => pick(today)}>
            Today
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => pick(addDays(today, -1))}>
            Yesterday
          </Button>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? dateOnlyToLocalDate(today)}
          weekStartsOn={1}
          disabled={disabled}
          onSelect={(date) => date && pick(localDateToDateOnly(date))}
          className="[--cell-size:--spacing(9)] md:[--cell-size:--spacing(8)]"
        />
      </PopoverContent>
    </Popover>
  )
}
