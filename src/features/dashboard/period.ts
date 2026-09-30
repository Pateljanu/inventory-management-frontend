import { businessToday, type DateOnly } from "@/lib/dates"
import { matchPreset, resolvePreset, type DateRange, type PresetId } from "@/lib/fy"

/** The quick periods offered above the dashboard, in the order shown. */
export const DASHBOARD_PRESETS = ["today", "this-week", "this-month", "this-fy"] as const satisfies PresetId[]

/** Words that finish "Delivered …" and "Bought …": "this month", "today", "in this period". */
const PERIOD_WORDS: Partial<Record<PresetId, string>> = {
  today: "today",
  yesterday: "yesterday",
  "this-week": "this week",
  "this-month": "this month",
  "last-month": "last month",
  "this-quarter": "this quarter",
  "this-fy": "this FY",
  "last-fy": "last FY",
}

export type DashboardPeriod = DateRange & { preset: PresetId | null; words: string; endsToday: boolean }

/**
 * The period the dashboard reports on. Ranges end today at the latest, because `to` is also the
 * date that stock and open orders are measured on.
 */
export function dashboardPeriod(
  search: { from?: DateOnly; to?: DateOnly },
  today = businessToday()
): DashboardPeriod {
  const valid = search.from && search.to && search.from <= search.to
  const range: DateRange = valid
    ? { from: search.from!, to: search.to! > today ? today : search.to! }
    : resolvePreset("this-month", today, { clampToToday: true })
  const preset = matchPreset(range, today, { clampToToday: true })
  return {
    ...range,
    preset,
    words: (preset && PERIOD_WORDS[preset]) ?? "in this period",
    endsToday: range.to === today,
  }
}
