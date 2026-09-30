import type { StatDelta } from "@/components/common/stat-card"
import { minus, percentOf, toBig } from "@/lib/decimal"
import { formatDate, formatMoneyCompact, formatPercent, formatTons } from "@/lib/format"

/** "8% vs Aug (₹1.82 Cr)": a rupee change against the comparison period; up is good news. */
export function moneyDelta(current: string, previous: string, vsLabel: string): StatDelta {
  const cur = toBig(current)
  const prev = toBig(previous)
  if (cur.eq(prev)) return { trend: "flat", tone: "neutral", text: `No change ${vsLabel}` }
  if (prev.eq(0)) return { trend: "up", tone: "good", text: `from ₹0 ${vsLabel}` }
  const change = Math.abs(percentOf(cur.minus(prev), prev))
  return {
    trend: cur.gt(prev) ? "up" : "down",
    tone: cur.gt(prev) ? "good" : "bad",
    text: `${formatPercent(change)} ${vsLabel} (${formatMoneyCompact(previous)})`,
  }
}

/**
 * How stock moved over the period. Stock only changes through purchases and deliveries, so the
 * change is simply bought − delivered; no second "as of" request is needed.
 */
export function stockDelta(bought: string, delivered: string, from: string): StatDelta {
  const change = minus(bought, delivered)
  const since = `since ${formatDate(from)}`
  if (change.eq(0)) return { trend: "flat", tone: "neutral", text: `No change ${since}` }
  return {
    trend: change.gt(0) ? "up" : "down",
    tone: "neutral",
    text: `${formatTons(change.abs().toFixed(3), { unit: true })} ${since}`,
  }
}
