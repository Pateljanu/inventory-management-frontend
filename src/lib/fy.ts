import { addDays, businessToday, daysBetween, type DateOnly } from "./dates"
import { formatDate } from "./format"

/*
 * Date presets for an Indian business. The financial year runs 1 April to 31 March:
 * if today is in January-March, the FY began on 1 April of the previous calendar year.
 * FY quarters: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.
 */

export type DateRange = { from: DateOnly; to: DateOnly }

export const PRESET_IDS = [
  "today",
  "yesterday",
  "this-week",
  "this-month",
  "last-month",
  "this-quarter",
  "this-fy",
  "last-fy",
] as const
export type PresetId = (typeof PRESET_IDS)[number]

export const PRESET_LABELS: Record<PresetId, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This week",
  "this-month": "This month",
  "last-month": "Last month",
  "this-quarter": "This quarter",
  "this-fy": "This FY",
  "last-fy": "Last FY",
}

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (y: number, m: number, d: number): DateOnly => `${y}-${pad(m)}-${pad(d)}`
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const parts = (value: DateOnly) => value.split("-").map(Number) as [number, number, number]

/** Calendar year in which the FY containing `date` starts. */
export function fyStartYear(date: DateOnly): number {
  const [y, m] = parts(date)
  return m <= 3 ? y - 1 : y
}

/** "FY 2026-27" */
export function fyLabel(date: DateOnly): string {
  const start = fyStartYear(date)
  return `FY ${start}-${String(start + 1).slice(2)}`
}

export function fyRange(date: DateOnly): DateRange {
  const start = fyStartYear(date)
  return { from: ymd(start, 4, 1), to: ymd(start + 1, 3, 31) }
}

export function monthRange(y: number, m: number): DateRange {
  return { from: ymd(y, m, 1), to: ymd(y, m, daysInMonth(y, m)) }
}

/** FY quarter containing `date`. */
export function quarterRange(date: DateOnly): DateRange {
  const [y, m] = parts(date)
  // Months grouped Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar.
  const startMonth = m <= 3 ? 1 : m <= 6 ? 4 : m <= 9 ? 7 : 10
  return { from: ymd(y, startMonth, 1), to: ymd(y, startMonth + 2, daysInMonth(y, startMonth + 2)) }
}

/** Monday to Sunday of the week containing `date`. */
export function weekRange(date: DateOnly): DateRange {
  const [y, m, d] = parts(date)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const fromMonday = (weekday + 6) % 7
  const from = addDays(date, -fromMonday)
  return { from, to: addDays(from, 6) }
}

/**
 * Resolves a preset against `today`. With `clampToToday`, ranges end today at the latest,
 * which reports need because `to` is also the as-of date for stock positions.
 */
export function resolvePreset(
  id: PresetId,
  today: DateOnly = businessToday(),
  opts: { clampToToday?: boolean } = {}
): DateRange {
  const [y, m] = parts(today)
  let range: DateRange
  switch (id) {
    case "today":
      range = { from: today, to: today }
      break
    case "yesterday": {
      const d = addDays(today, -1)
      range = { from: d, to: d }
      break
    }
    case "this-week":
      range = weekRange(today)
      break
    case "this-month":
      range = monthRange(y, m)
      break
    case "last-month":
      range = m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1)
      break
    case "this-quarter":
      range = quarterRange(today)
      break
    case "this-fy":
      range = fyRange(today)
      break
    case "last-fy":
      range = fyRange(ymd(fyStartYear(today) - 1, 6, 1))
      break
  }
  if (opts.clampToToday && range.to > today) range = { ...range, to: today }
  return range
}

/** Which preset (if any) a range matches exactly, for highlighting the active chip. */
export function matchPreset(
  range: Partial<DateRange>,
  today: DateOnly = businessToday(),
  opts: { clampToToday?: boolean } = {}
): PresetId | null {
  if (!range.from || !range.to) return null
  for (const id of PRESET_IDS) {
    const r = resolvePreset(id, today, opts)
    if (r.from === range.from && r.to === range.to) return id
  }
  return null
}

/** "This month · 01/09/2026 – 30/09/2026" or "01/09/2026 – 15/09/2026". */
export function describeRange(from?: string, to?: string): string {
  if (!from && !to) return "All dates"
  const preset = from && to ? matchPreset({ from, to }) : null
  const dates = from && to ? (from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`) : ""
  if (preset) return `${PRESET_LABELS[preset]} · ${dates}`
  if (from && !to) return `From ${formatDate(from)}`
  if (!from && to) return `Up to ${formatDate(to)}`
  return dates
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** The same day `n` months earlier, clamped to the end of a shorter month (31 Mar → 28/29 Feb). */
function shiftMonths(date: DateOnly, n: number): DateOnly {
  const [y, m, d] = parts(date)
  const index = y * 12 + (m - 1) - n
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  return ymd(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

export type Comparison = { range: DateRange; label: string }

/**
 * The period a KPI is compared with, "like for like": 1–27 Sep is compared with 1–27 Aug (not the
 * 27 days before), an FY-to-date with the same dates last FY, a quarter with the last quarter's
 * same days, and anything else with the period of the same length just before it.
 */
export function comparisonRange({ from, to }: DateRange): Comparison {
  const [fy, fm, fd] = parts(from)
  const [ty, tm] = parts(to)
  const sameMonth = fy === ty && fm === tm
  const fyStart = fyRange(from)

  if (fm === 4 && fd === 1 && to <= fyStart.to) {
    const range = { from: shiftMonths(from, 12), to: shiftMonths(to, 12) }
    return { range, label: `vs ${fyLabel(range.from)}` }
  }
  const quarter = quarterRange(from)
  if (from === quarter.from && to <= quarter.to && !sameMonth) {
    const range = { from: shiftMonths(from, 3), to: shiftMonths(to, 3) }
    return { range, label: "vs last quarter" }
  }
  if (fd === 1 && sameMonth) {
    const range = { from: shiftMonths(from, 1), to: shiftMonths(to, 1) }
    return { range, label: `vs ${MONTHS[parts(range.from)[1] - 1]}` }
  }
  const length = daysBetween(from, to) + 1
  const range = { from: addDays(from, -length), to: addDays(from, -1) }
  if (length === 1) return { range, label: "vs the day before" }
  if (length === 7 && weekRange(from).from === from) return { range, label: "vs last week" }
  return { range, label: `vs previous ${length} days` }
}
