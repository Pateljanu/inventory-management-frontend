import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/empty-state"
import { isPositive, minus, percentOf, toBig } from "@/lib/decimal"
import { formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DashboardMaterialRow } from "@/types/api"

/**
 * Stock in the yard against open orders, one pair of bars per material, most short first, with
 * the shortfall or extra written at the end. Bars start at zero and share one scale; exact tons
 * are always printed, so the chart doubles as its own table.
 */
export function StockVsOrders({
  materials,
  loading,
  asOfToday,
  className,
}: {
  materials: DashboardMaterialRow[]
  loading: boolean
  asOfToday: boolean
  className?: string
}) {
  const rows = materials
    .filter((m) => isPositive(m.currentStockTons) || isPositive(m.remainingPOQuantityTons))
    .map((m) => ({ ...m, balance: minus(m.currentStockTons, m.remainingPOQuantityTons) }))
    .sort((a, b) => a.balance.cmp(b.balance))
  const scale = rows.reduce((max, r) => {
    const top = toBig(r.currentStockTons).gt(toBig(r.remainingPOQuantityTons))
      ? toBig(r.currentStockTons)
      : toBig(r.remainingPOQuantityTons)
    return top.gt(max) ? top : max
  }, toBig(0))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Stock vs open orders</CardTitle>
        <CardDescription>
          {asOfToday ? "In the yard today" : "In the yard on the last day of the period"}, against orders
          still to deliver.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Legend />
        {loading ? (
          <div className="mt-3 flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No stock or open orders"
            description="Record purchases to build stock; sales orders show up here as demand."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {rows.map((r) => {
              const shortBy = r.balance.lt(0)
              return (
                <li key={r.materialId} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Link
                      to="/materials/$materialId"
                      params={{ materialId: r.materialId }}
                      className="truncate font-medium hover:underline"
                    >
                      {r.materialName}
                    </Link>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums",
                        shortBy ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
                      )}
                    >
                      {shortBy ? <TriangleAlert className="size-3.5" aria-hidden /> : null}
                      {shortBy
                        ? `Short ${formatTons(r.balance.abs().toFixed(3), { unit: true })}`
                        : r.balance.gt(0)
                          ? `Extra ${formatTons(r.balance.toFixed(3), { unit: true })}`
                          : "Just enough"}
                    </span>
                  </div>
                  <Bar
                    label="In yard"
                    tons={r.currentStockTons}
                    scale={scale.toFixed(3)}
                    className="bg-chart-1"
                  />
                  <Bar
                    label="Open orders"
                    tons={r.remainingPOQuantityTons}
                    scale={scale.toFixed(3)}
                    className="bg-chart-2"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Legend() {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-1" /> In yard
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-chart-2" /> Open orders
      </span>
    </div>
  )
}

function Bar({
  label,
  tons,
  scale,
  className,
}: {
  label: string
  tons: string
  scale: string
  className: string
}) {
  const pct = percentOf(tons, scale)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="sr-only">{label}:</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-(--duration-slow)", className)}
          style={{ width: `${Math.max(pct, isPositive(tons) ? 1 : 0)}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-muted-foreground tabular-nums">
        {formatTons(tons, { unit: true })}
      </span>
    </div>
  )
}
