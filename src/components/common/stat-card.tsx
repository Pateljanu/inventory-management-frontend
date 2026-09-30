import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AppPath } from "@/components/layout/nav"
import { cn } from "@/lib/utils"

/** A change against another period, always with an arrow and words so colour is never the only cue. */
export type StatDelta = {
  /** "▲ 8% vs Aug" without the arrow: "8% vs Aug (₹1.82 Cr)". */
  text: string
  trend: "up" | "down" | "flat"
  /** Whether the change is good news; neutral changes stay grey. */
  tone?: "good" | "bad" | "neutral"
}

type StatCardProps = {
  label: string
  /** Compact display value ("286.5 t", "₹1.96 Cr"). */
  value: ReactNode
  /** Exact value shown in a tooltip when the display value is rounded. */
  exactValue?: string
  delta?: StatDelta
  footnote?: ReactNode
  icon?: ReactNode
  tone?: "default" | "warning"
  /** Drill-down link: every KPI leads to the records behind it. */
  href?: AppPath
  /** Filters for the linked list, e.g. the same date range. */
  search?: Record<string, unknown>
  loading?: boolean
}

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight }
// Flat changes already say "No change" in their text.
const TREND_WORD = { up: "Up", down: "Down", flat: "" }

export function StatCard({
  label,
  value,
  exactValue,
  delta,
  footnote,
  icon,
  tone = "default",
  href,
  search,
  loading,
}: StatCardProps) {
  const linked = Boolean(href) && !loading
  const Trend = delta ? TREND_ICON[delta.trend] : null

  const body = (
    <Card
      className={cn(
        "h-full gap-2 px-4 py-4 transition-colors duration-(--duration-fast)",
        linked && "hover:bg-muted/30 hover:ring-foreground/20",
        tone === "warning" && "ring-warning/60"
      )}
    >
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-36" />
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
            {exactValue ? (
              <Tooltip>
                {/* Inside a link the trigger must not take focus of its own; the exact value is
                    then read out through the sr-only text instead. */}
                <TooltipTrigger
                  render={
                    <span
                      tabIndex={linked ? undefined : 0}
                      className="outline-none focus-visible:underline"
                    />
                  }
                >
                  {value}
                  {linked ? <span className="sr-only"> (exactly {exactValue})</span> : null}
                </TooltipTrigger>
                <TooltipContent>Exact: {exactValue}</TooltipContent>
              </Tooltip>
            ) : (
              value
            )}
          </div>
          {delta && Trend ? (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium tabular-nums",
                delta.tone === "good" && "text-success",
                delta.tone === "bad" && "text-destructive",
                (!delta.tone || delta.tone === "neutral") && "text-muted-foreground"
              )}
            >
              <Trend className="size-3.5 shrink-0" aria-hidden />
              <span>
                {TREND_WORD[delta.trend] ? <span className="sr-only">{TREND_WORD[delta.trend]} </span> : null}
                {delta.text}
              </span>
            </div>
          ) : null}
          {footnote ? <div className="text-xs text-muted-foreground tabular-nums">{footnote}</div> : null}
        </>
      )}
    </Card>
  )

  if (!linked || !href) return body
  return (
    <Link
      to={href}
      // The target list's search type varies with `to`; callers pass matching filters.
      search={search as never}
      className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  )
}
