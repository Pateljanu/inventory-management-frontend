import { Link } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/empty-state"
import { minus, percentOf, toBig } from "@/lib/decimal"
import { formatCount, formatMoney, formatRate, formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { BuyerActivity, SupplierStock } from "./company-wise"

type Range = { from: string; to: string }

function Loading() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

/**
 * Stock held per supplier (bought from them, not yet delivered) with its materials, and what was
 * bought from each in the period. Opening stock has no supplier, so any yard stock beyond the
 * suppliers' total is called out.
 */
export function StockBySupplier({
  rows,
  yardTons,
  loading,
  asOfToday,
  range,
  className,
}: {
  rows: SupplierStock[]
  /** All stock in the yard, to spot stock that isn't tied to a supplier. */
  yardTons: string
  loading: boolean
  asOfToday: boolean
  range: Range
  className?: string
}) {
  const heldBySuppliers = rows.reduce((sum, r) => sum.plus(toBig(r.availableTons)), toBig(0))
  const unassigned = minus(yardTons, heldBySuppliers)
  const scale = rows[0]?.availableTons ?? "0"

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Stock by supplier</CardTitle>
        <CardDescription>
          {asOfToday ? "Stock in the yard today" : "Stock on the last day of the period"}, by who you bought
          it from. Bought figures are for the period.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No supplier stock"
            description="Record a purchase and the supplier's stock shows up here."
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.companyId} className="flex flex-col gap-1.5 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to="/company-report"
                    search={{ company: r.companyId, ...range }}
                    className="truncate font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatTons(r.availableTons, { unit: true })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${toBig(scale).gt(0) ? percentOf(r.availableTons, scale) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {r.materials.length
                    ? r.materials
                        .map((m) => `${m.name} ${formatTons(m.availableTons, { unit: true })}`)
                        .join(" · ")
                    : "Nothing left in stock"}
                </p>
                {r.bought ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Bought {formatTons(r.bought.tons, { unit: true })} · {formatMoney(r.bought.value)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!loading && unassigned.gt(0) ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Plus {formatTons(unassigned.toFixed(3), { unit: true })} of opening stock not tied to a supplier.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="text-sm">
        <Link to="/supplier-stock" className="font-medium text-primary hover:underline">
          All supplier stock
        </Link>
      </CardFooter>
    </Card>
  )
}

/** What each buyer took in the period, and (for a period ending today) what their open orders still need. */
export function Buyers({
  rows,
  loading,
  range,
  className,
}: {
  rows: BuyerActivity[]
  loading: boolean
  range: Range
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Buyers</CardTitle>
        <CardDescription>
          Delivered to each buyer in the period, and what their open orders still need.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No deliveries or open orders"
            description="Buyers show up here once they have an order or a delivery."
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.companyId} className="flex flex-col gap-1 py-2.5 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to="/company-report"
                    search={{ company: r.companyId, ...range }}
                    className="truncate font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums",
                      r.delivered ? "font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {r.delivered ? formatMoney(r.delivered.value) : "No deliveries"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {r.delivered
                    ? `Delivered ${formatTons(r.delivered.tons, { unit: true })} · avg ${formatRate(r.delivered.averageRate)}`
                    : null}
                  {r.delivered && r.open?.count ? " · " : null}
                  {r.open?.count
                    ? `${formatCount(r.open.count)} open ${r.open.count === 1 ? "order" : "orders"}, ${formatTons(r.open.leftTons, { unit: true })} left`
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="gap-4 text-sm">
        <Link to="/deliveries" search={range} className="font-medium text-primary hover:underline">
          All deliveries
        </Link>
        <Link to="/sales-orders" className="font-medium text-primary hover:underline">
          All orders
        </Link>
      </CardFooter>
    </Card>
  )
}
