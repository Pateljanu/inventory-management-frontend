import type { TrendBucket } from "@/types/api"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const parts = (v: string) => v.split("-").map(Number) as [number, number, number]
const pad = (n: number) => String(n).padStart(2, "0")

/** Axis label for a trend bucket: "28 Sep", "01–06 Sep", "28 Sep–04 Oct", "Sep 2026". */
export function bucketLabel(start: string, end: string, bucket: TrendBucket): string {
  const [sy, sm, sd] = parts(start)
  const [, em, ed] = parts(end)
  if (bucket === "month") return `${MONTHS[sm - 1]} ${sy}`
  if (bucket === "day" || start === end) return `${pad(sd)} ${MONTHS[sm - 1]}`
  return sm === em
    ? `${pad(sd)}–${pad(ed)} ${MONTHS[sm - 1]}`
    : `${pad(sd)} ${MONTHS[sm - 1]}–${pad(ed)} ${MONTHS[em - 1]}`
}
