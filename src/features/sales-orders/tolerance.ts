import { isPositive, minus, toBig } from "@/lib/decimal"
import type { SalesPO } from "@/types/api"

/** Pre-filled on new orders: deliveries may go this far beyond the ordered tons. */
export const DEFAULT_TOLERANCE_PERCENT = "10"
export const MAX_TOLERANCE_PERCENT = 50

/** Ordered tons plus the tolerance, rounded down to 3 decimals (the same rule as the server). */
export function maxDeliverable(quantityTons: string, tolerancePercent: string | undefined): string {
  return toBig(quantityTons)
    .times(toBig(1).plus(toBig(tolerancePercent ?? "0").div(100)))
    .round(3, 0)
    .toFixed(3)
}

/** Delivered less than ordered on a live order: settling closes it at what was delivered. */
export const canSettleOrder = (po: SalesPO) =>
  po.lifecycleStatus === "ACTIVE" && po.displayStatus === "PARTIALLY_SUPPLIED"

/** Tons a settle took off the order, when it was settled short; otherwise null. */
export function settledShortBy(po: SalesPO): string | null {
  if (!po.originalQuantityTons) return null
  const short = minus(po.originalQuantityTons, po.quantityTons)
  return isPositive(short) ? short.toFixed(3) : null
}
