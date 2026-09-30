import Big from "big.js"

/*
 * Exact decimal arithmetic on the strings the API returns ("30.250"). Floats are never used
 * for tons, rates or money. Rounding is half-up, matching the backend's Decimal.js setup.
 */
Big.RM = Big.roundHalfUp

export const QTY_SCALE = 3
export const RATE_SCALE = 2
export const MONEY_SCALE = 2

export type DecimalInput = string | number | Big | null | undefined

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

/** True for a plain decimal string such as "12", "12.450" or "-3.2". */
export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && DECIMAL_PATTERN.test(value.trim())
}

/** Converts API values into Big. Empty or invalid input becomes 0. */
export function toBig(value: DecimalInput): Big {
  if (value instanceof Big) return value
  if (value == null) return new Big(0)
  if (typeof value === "number") return Number.isFinite(value) ? new Big(value) : new Big(0)
  const trimmed = value.trim()
  return isDecimalString(trimmed) ? new Big(trimmed) : new Big(0)
}

/** tons x rate, rounded half-up to 2 decimals, as a string (same rule as the backend). */
export function amountFrom(quantityTons: DecimalInput, ratePerTon: DecimalInput): string {
  return toBig(quantityTons).times(toBig(ratePerTon)).toFixed(MONEY_SCALE)
}

export const fixed = (value: DecimalInput, scale: number) => toBig(value).toFixed(scale)
export const qty = (value: DecimalInput) => fixed(value, QTY_SCALE)
export const money = (value: DecimalInput) => fixed(value, MONEY_SCALE)

export const plus = (a: DecimalInput, b: DecimalInput) => toBig(a).plus(toBig(b))
export const minus = (a: DecimalInput, b: DecimalInput) => toBig(a).minus(toBig(b))
export const cmp = (a: DecimalInput, b: DecimalInput) => toBig(a).cmp(toBig(b))
export const isZero = (value: DecimalInput) => toBig(value).eq(0)
export const isNegative = (value: DecimalInput) => toBig(value).lt(0)
export const isPositive = (value: DecimalInput) => toBig(value).gt(0)

/** Smallest of several decimals (e.g. the binding delivery limit). */
export function minOf(...values: DecimalInput[]): Big {
  return values.map(toBig).reduce((a, b) => (b.lt(a) ? b : a))
}

/** Percent of `part` in `whole`, 0 when whole is 0. Returned as a JS number for bars only. */
export function percentOf(part: DecimalInput, whole: DecimalInput): number {
  const w = toBig(whole)
  if (w.eq(0)) return 0
  return Number(toBig(part).div(w).times(100).toFixed(1))
}
