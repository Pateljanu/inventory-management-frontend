import { isDecimalString, isPositive, percentOf, qty, toBig } from "@/lib/decimal"
import { compareDates, isDateOnly } from "@/lib/dates"
import { formatDate, formatTons } from "@/lib/format"
import type { LimitKind, SaleCapacity } from "@/types/api"

/*
 * What the delivery form shows about its three limits (order left, yard stock, supplier stock)
 * for the tons typed so far. Pure, so the thresholds are unit-tested.
 */

/** "Close to the limit" starts at 80% of the maximum. */
export const NEAR_RATIO = 0.8

/** near = 80–99% of a limit; full = exactly all of it (fine, and the usual default). */
export type LimitLevel = "empty" | "ok" | "near" | "full" | "over"

export type LimitRow = {
  kind: LimitKind
  /** The limit itself, e.g. "11.750". */
  value: string
  /** Typed tons as a share of this limit, clamped to 0–100. */
  fill: number
  level: LimitLevel
  /** This is the smallest limit. */
  binding: boolean
  /** What is left of this limit after the typed tons (may be negative). */
  after: string | null
}

export type LimitAssessment = {
  level: LimitLevel
  /** The most that can be delivered, e.g. "9.200". */
  max: string
  /** max − typed tons, when tons are typed. */
  spare: string | null
  rows: LimitRow[]
}

const levelFor = (typed: string | null, limit: string): LimitLevel => {
  if (typed === null) return "empty"
  const t = toBig(typed)
  const l = toBig(limit)
  if (t.gt(l)) return "over"
  if (t.eq(l)) return "full"
  return t.gte(l.times(NEAR_RATIO)) ? "near" : "ok"
}

/** Typed text that is a usable tons figure, or null ("", "abc", "0"). */
export function typedTons(value: string): string | null {
  return isDecimalString(value) && isPositive(value) ? value : null
}

export function assessLimits(capacity: SaleCapacity, tonsText: string): LimitAssessment {
  const typed = typedTons(tonsText)
  const limits: [LimitKind, string][] = [
    ["PO", capacity.remainingQuantityTons],
    ["STOCK", capacity.availableStockTons],
    ...(capacity.availableSourceStockTons !== null
      ? [["SOURCE_STOCK", capacity.availableSourceStockTons] as [LimitKind, string]]
      : []),
  ]
  const rows = limits.map(([kind, value]): LimitRow => {
    const positive = isPositive(value)
    const fill = typed === null ? 0 : positive ? Math.min(100, percentOf(typed, value)) : 100
    return {
      kind,
      value: qty(value),
      fill,
      level: levelFor(typed, value),
      binding: kind === capacity.limitedBy,
      after: typed === null ? null : qty(toBig(value).minus(toBig(typed))),
    }
  })
  return {
    level: levelFor(typed, capacity.maxAllowedTons),
    max: qty(capacity.maxAllowedTons),
    spare: typed === null ? null : qty(toBig(capacity.maxAllowedTons).minus(toBig(typed))),
    rows,
  }
}

export type LimitNames = {
  poNumber: string
  material: string
  source?: string | null
  /** The delivery date, when known. */
  saleDate?: string
  /** The chosen supplier's first purchase of the material: null = never bought, undefined = not known. */
  sourceFirstPurchaseDate?: string | null
}

export type SourceDateProblem = { field: "saleDate" | "source"; message: string }

/**
 * A supplier that can't serve this date at all: you never bought the material from them, or
 * their first purchase is after the delivery date. Null when fine or not known.
 */
export function sourceDateProblem(names: LimitNames): SourceDateProblem | null {
  const first = names.sourceFirstPurchaseDate
  const source = names.source ?? "this supplier"
  if (first === null) {
    return {
      field: "source",
      message: `You haven't bought any ${names.material} from ${source}. Choose another supplier.`,
    }
  }
  if (first && names.saleDate && isDateOnly(names.saleDate) && compareDates(names.saleDate, first) < 0) {
    return {
      field: "saleDate",
      message: `${source} first sold you ${names.material} on ${formatDate(first)}. Choose that date or later, or another supplier.`,
    }
  }
  return null
}

/** What each limit is called on screen: "Left on PO-0142", "HMS 1 in yard", "Shree Ganesh Metals stock". */
export function limitLabel(kind: LimitKind, names: LimitNames): string {
  if (kind === "PO") return `Left on ${names.poNumber}`
  if (kind === "STOCK") return `${names.material} in yard`
  return `${names.source ?? "Supplier"} stock`
}

/** "Limited by …" wording for the binding limit. */
export function limitReason(kind: LimitKind, names: LimitNames): string {
  if (kind === "PO") return `what's left on ${names.poNumber}`
  if (kind === "STOCK") return `${names.material} stock in the yard`
  return `${names.source ?? "the supplier's"} stock`
}

/** The error under Tons when the typed tons are more than a limit allows. */
export function overLimitMessage(kind: LimitKind, maxAllowed: string, names: LimitNames): string {
  const none = !isPositive(maxAllowed)
  const maxTons = formatTons(maxAllowed, { unit: true })
  if (kind === "PO") {
    return none
      ? `${names.poNumber} is fully delivered. Choose another order.`
      : `${names.poNumber} has only ${maxTons} left to deliver. Enter ${maxTons} or less.`
  }
  if (kind === "STOCK") {
    return none
      ? `There is no ${names.material} free in the yard on this date.`
      : `Only ${maxTons} of ${names.material} is free in the yard on this date. Enter ${maxTons} or less.`
  }
  const source = names.source ?? "this supplier"
  const dateProblem = none ? sourceDateProblem(names) : null
  if (dateProblem) return dateProblem.message
  return none
    ? `${source} has no ${names.material} left on this date. Choose another supplier.`
    : `Only ${maxTons} of ${names.material} from ${source} is left. Enter ${maxTons} or less, or choose another supplier.`
}

/** Which limit a 409 from POST/PATCH /sales was about. */
export function limitKindFromCode(code: string): LimitKind | null {
  if (code === "PO_QUANTITY_EXCEEDED") return "PO"
  if (code === "INSUFFICIENT_STOCK") return "STOCK"
  if (code === "INSUFFICIENT_SOURCE_STOCK") return "SOURCE_STOCK"
  return null
}
