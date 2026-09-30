import Big from "big.js"
import { toBig, type DecimalInput } from "./decimal"

/*
 * The only place in the app that formats numbers and dates for display.
 * - Exact values (tables, forms, toasts): en-IN grouping, fixed decimals, never compact.
 * - Compact values (KPI tiles, chart axes only): custom lakh/crore formatter, because the
 *   built-in compact notation printed "1.2KCr".
 * Values stay decimal strings from the API to Intl, which formats strings exactly.
 */

const MINUS = "−" // true minus sign for negatives
const DASH = "—" // "not applicable"

const cache = new Map<string, Intl.NumberFormat>()
function nf(min: number, max = min): Intl.NumberFormat {
  const key = `${min}:${max}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat("en-IN", { minimumFractionDigits: min, maximumFractionDigits: max })
    cache.set(key, f)
  }
  return f
}

/** Formats |value| with the given decimals and prefixes a true minus when negative. */
function signed(value: Big, decimals: number, prefix = ""): string {
  const abs = value.abs().round(decimals)
  const text = prefix + nf(decimals).format(abs.toFixed(decimals) as Intl.StringNumericLiteral)
  // "-0.0001" rounds to zero and must not print as "−0.000".
  return value.lt(0) && !abs.eq(0) ? MINUS + text : text
}

type Nullable = DecimalInput

/** 1,284.500 — tons in tables (unit lives in the column header). */
export function formatTons(value: Nullable, opts: { unit?: boolean } = {}): string {
  if (value == null || value === "") return DASH
  const text = signed(toBig(value), 3)
  return opts.unit ? `${text} t` : text
}

/** 286.5 t — KPI tiles; always show the exact value nearby (tooltip or subtitle). */
export function formatTonsCompact(value: Nullable): string {
  if (value == null || value === "") return DASH
  return `${signed(toBig(value), 1)} t`
}

/** 11,87,894.21 (tables) or ₹11,87,894.21 (cards, forms, toasts). */
export function formatMoney(value: Nullable, opts: { symbol?: boolean } = {}): string {
  if (value == null || value === "") return DASH
  return signed(toBig(value), 2, opts.symbol === false ? "" : "₹")
}

/** ₹38,500.00/t */
export function formatRate(value: Nullable, opts: { unit?: boolean } = { unit: true }): string {
  if (value == null || value === "") return DASH
  const text = signed(toBig(value), 2, "₹")
  return opts.unit === false ? text : `${text}/t`
}

const LAKH = new Big(100_000)
const CRORE = new Big(10_000_000)

/** At most 3 significant digits, trailing zeros removed ("12.5", "1.96", "245"). */
function threeSig(value: Big): string {
  const digitsBeforePoint = value.round(0, Big.roundDown).toString().length
  const decimals = Math.max(0, 3 - digitsBeforePoint)
  return new Big(value.toFixed(decimals)).toString()
}

/**
 * Custom Indian compact money for KPI tiles and chart axes:
 * under ₹1 L full rupees (₹87,500), ₹1 L to ₹1 Cr in lakh (₹8.75 L, ₹12.5 L),
 * ₹1 Cr and above in crore (₹1.96 Cr, ₹245 Cr, ₹1,245 Cr).
 */
export function formatMoneyCompact(value: Nullable): string {
  if (value == null || value === "") return DASH
  const v = toBig(value)
  const abs = v.abs()
  const sign = v.lt(0) ? MINUS : ""
  if (abs.lt(LAKH)) return `${sign}₹${nf(0).format(abs.toFixed(0) as Intl.StringNumericLiteral)}`

  let unitValue: Big
  let unit: string
  if (abs.lt(CRORE)) {
    unitValue = abs.div(LAKH)
    unit = "L"
    // 99.95 L rounds to 100 L; show it as 1 Cr instead.
    if (new Big(threeSig(unitValue)).gte(100)) {
      unitValue = abs.div(CRORE)
      unit = "Cr"
    }
  } else {
    unitValue = abs.div(CRORE)
    unit = "Cr"
  }
  const number = unitValue.gte(1000)
    ? nf(0).format(unitValue.toFixed(0) as Intl.StringNumericLiteral)
    : threeSig(unitValue)
  return `${sign}₹${number} ${unit}`
}

/** 61% — badges and bars. */
export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return DASH
  return `${nf(decimals).format(value)}%`
}

/** Plain count with Indian grouping: 1,24,500 */
export function formatCount(value: number | null | undefined): string {
  if (value == null) return DASH
  return nf(0).format(value)
}

/**
 * DD/MM/YYYY from an API business date. Business dates arrive as UTC midnight
 * ("2026-09-27T00:00:00.000Z") or as "2026-09-27"; only the calendar part is used, so the
 * date never shifts across time zones.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return DASH
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return DASH
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** 27/09/2026, 14:05 — technical timestamps (createdAt) in the business time zone. */
export function formatDateTime(value: string | null | undefined, timeZone = "Asia/Kolkata"): string {
  if (!value) return DASH
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return DASH
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" })

/** "2 min ago", "just now" — freshness and activity only, never for records. */
export function formatRelative(from: number, now = Date.now()): string {
  const seconds = Math.round((from - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "just now"
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour")
  return rtf.format(Math.round(seconds / 86_400), "day")
}

export { DASH, MINUS }
