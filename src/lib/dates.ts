import { config } from "./config"

/*
 * Business dates are calendar days ("YYYY-MM-DD"). They are sent to the API as strings and
 * never through toISOString(), which shifts IST dates back by a day.
 */

export type DateOnly = string // "YYYY-MM-DD"

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today's calendar date in the business time zone (Asia/Kolkata by default). */
export function businessToday(now = new Date(), timeZone = config.businessTimeZone): DateOnly {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string") return false
  const m = DATE_ONLY.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** "2026-09-27T00:00:00.000Z" or "2026-09-27" -> "2026-09-27". */
export function toDateOnly(value: string | null | undefined): DateOnly | null {
  if (!value) return null
  const part = value.slice(0, 10)
  return isDateOnly(part) ? part : null
}

/** Calendar Date (local midnight) for date pickers. */
export function dateOnlyToLocalDate(value: DateOnly): Date {
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Local calendar Date from a date picker -> "YYYY-MM-DD" (no time zone conversion). */
export function localDateToDateOnly(date: Date): DateOnly {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Pure calendar arithmetic on "YYYY-MM-DD" strings (UTC-based, so DST never matters). */
export function addDays(value: DateOnly, days: number): DateOnly {
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export function compareDates(a: DateOnly, b: DateOnly): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Whole days from `a` to `b` (0 for the same day; negative when b is earlier). */
export function daysBetween(a: DateOnly, b: DateOnly): number {
  const utc = (v: DateOnly) => {
    const [y, m, d] = v.split("-").map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}
