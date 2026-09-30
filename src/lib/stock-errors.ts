import { isApiError } from "./api-client"
import { toBig } from "./decimal"
import { formatDate, formatTons } from "./format"

/**
 * Plain words for the backend's history checks. An edit is refused when, replayed day by day,
 * it would leave the yard (or one supplier's stock) below zero on some past day, because a
 * delivery already used that stock.
 */
export function stockHistoryMessage(error: unknown): string | null {
  if (!isApiError(error)) return null
  if (error.code !== "NEGATIVE_STOCK_HISTORY" && error.code !== "NEGATIVE_SOURCE_STOCK_HISTORY") return null
  const at = formatDate(String(error.details?.at ?? ""))
  const short = formatTons(
    toBig(String(error.details?.balanceTons ?? "0"))
      .abs()
      .toFixed(3),
    { unit: true }
  )
  const whose = error.code === "NEGATIVE_SOURCE_STOCK_HISTORY" ? "this supplier's stock" : "the yard's stock"
  return `This change can't be saved: deliveries already made would have used more than ${whose} held on ${at} (short by ${short}).`
}
