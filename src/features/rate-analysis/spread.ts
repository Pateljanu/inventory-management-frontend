import { isPositive, minus, toBig, type DecimalInput } from "@/lib/decimal"

/*
 * The gap between the average selling and buying rate (₹/t), and that gap as a share of the
 * buying rate. Pure, so the edge cases are unit-tested.
 */

export type RateSpread = {
  /** Avg selling − avg buying, e.g. "5000.00" or "-1250.50". */
  amount: string
  /** amount ÷ avg buying × 100, e.g. 17.54. */
  percent: number
  tone: "good" | "bad" | "neutral"
}

/**
 * Null unless something was both bought and sold: a rate from one side only has nothing to
 * compare with, and a zero buying rate has no meaningful percentage.
 */
export function rateSpread(
  boughtTons: DecimalInput,
  averageBuyingRate: DecimalInput,
  soldTons: DecimalInput,
  averageSellingRate: DecimalInput
): RateSpread | null {
  if (!isPositive(boughtTons) || !isPositive(soldTons) || !isPositive(averageBuyingRate)) return null
  const amount = minus(averageSellingRate, averageBuyingRate)
  const percent = Number(amount.div(toBig(averageBuyingRate)).times(100).toFixed(2))
  return {
    amount: amount.toFixed(2),
    percent,
    tone: amount.gt(0) ? "good" : amount.lt(0) ? "bad" : "neutral",
  }
}
