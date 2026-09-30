import { Link } from "@tanstack/react-router"
import { ArrowDownToLine, Truck } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/empty-state"
import { formatDate, formatMoney, formatTons } from "@/lib/format"
import type { Purchase, Sale } from "@/types/api"

const SHOWN = 6

type Activity =
  | { kind: "purchase"; date: string; createdAt: string; record: Purchase }
  | { kind: "delivery"; date: string; createdAt: string; record: Sale }

/** The latest purchases and deliveries together, newest first (by business date, then entry time). */
function mergeActivity(purchases: Purchase[], deliveries: Sale[]): Activity[] {
  return [
    ...purchases.map((p): Activity => ({
      kind: "purchase",
      date: p.purchaseDate,
      createdAt: p.createdAt,
      record: p,
    })),
    ...deliveries.map((s): Activity => ({
      kind: "delivery",
      date: s.saleDate,
      createdAt: s.createdAt,
      record: s,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, SHOWN)
}

export function RecentActivity({
  purchases,
  deliveries,
  loading,
  className,
}: {
  purchases: Purchase[] | undefined
  deliveries: Sale[] | undefined
  loading: boolean
  className?: string
}) {
  const items = mergeActivity(purchases ?? [], deliveries ?? [])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>The latest purchases and deliveries.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Purchases and deliveries appear here as you save them."
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((item) => (
              <li key={`${item.kind}-${item.record._id}`} className="flex items-center gap-3 py-2 text-sm">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-label={item.kind === "purchase" ? "Purchase" : "Delivery"}
                  role="img"
                >
                  {item.kind === "purchase" ? (
                    <ArrowDownToLine className="size-4" />
                  ) : (
                    <Truck className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {item.kind === "purchase" ? (
                    <p className="truncate font-medium">{item.record.companyId.name}</p>
                  ) : (
                    <p className="truncate">
                      <Link
                        to="/sales-orders/$orderId"
                        params={{ orderId: item.record.poId._id }}
                        className="font-medium hover:underline"
                      >
                        {item.record.poId.poNumber}
                      </Link>{" "}
                      <span className="text-muted-foreground">· {item.record.companyId.name}</span>
                    </p>
                  )}
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {formatDate(item.date)} · {item.record.materialId.name} ·{" "}
                    {formatTons(item.record.quantityTons, { unit: true })}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(item.record.totalAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="gap-4 text-sm">
        <Link to="/purchases" className="font-medium text-primary hover:underline">
          All purchases
        </Link>
        <Link to="/deliveries" className="font-medium text-primary hover:underline">
          All deliveries
        </Link>
      </CardFooter>
    </Card>
  )
}
