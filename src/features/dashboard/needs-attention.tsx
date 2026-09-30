import { Link } from "@tanstack/react-router"
import { ArrowRight, Plus, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { DeliverButton } from "@/features/sales-orders/order-parts"
import { cmp, isPositive } from "@/lib/decimal"
import { daysBetween, toDateOnly, type DateOnly } from "@/lib/dates"
import { formatCount, formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { DashboardMaterialRow, SalesPO } from "@/types/api"

const ORDERS_SHOWN = 5

type NeedsAttentionProps = {
  materials: DashboardMaterialRow[]
  openOrders: SalesPO[] | undefined
  openOrderTotal: number | undefined
  loading: boolean
  canWrite: boolean
  today: DateOnly
  className?: string
}

/**
 * What to act on today: materials whose open orders need more than the yard holds (buy), and the
 * orders that have waited longest (deliver). Each row carries its one action.
 */
export function NeedsAttention({
  materials,
  openOrders,
  openOrderTotal,
  loading,
  canWrite,
  today,
  className,
}: NeedsAttentionProps) {
  const short = materials
    .filter((m) => isPositive(m.purchaseRequiredTons))
    .sort((a, b) => cmp(b.purchaseRequiredTons, a.purchaseRequiredTons))
  const waiting = [...(openOrders ?? [])].sort((a, b) =>
    a.poDate < b.poDate ? -1 : a.poDate > b.poDate ? 1 : 0
  )
  const nothing = !loading && short.length === 0 && waiting.length === 0

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>Things to act on today.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)
        ) : nothing ? (
          <EmptyState
            kind="all-done"
            title="Nothing needs attention"
            description="Stock covers every open order and no orders are waiting."
          />
        ) : (
          <>
            {short.length ? (
              <Section title={`Buy needed (${short.length})`}>
                {short.map((m) => (
                  <Row
                    key={m.materialId}
                    icon={<TriangleAlert className="size-4 text-warning" aria-label="Short" />}
                    title={
                      <>
                        <Link
                          to="/materials/$materialId"
                          params={{ materialId: m.materialId }}
                          className="font-medium hover:underline"
                        >
                          {m.materialName}
                        </Link>{" "}
                        <span className="text-muted-foreground">short</span>{" "}
                        <strong className="tabular-nums">
                          {formatTons(m.purchaseRequiredTons, { unit: true })}
                        </strong>
                      </>
                    }
                    detail={`Orders ${formatTons(m.remainingPOQuantityTons, { unit: true })} · in yard ${formatTons(m.currentStockTons, { unit: true })}`}
                    action={
                      canWrite ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="pointer-coarse:h-11"
                          render={<Link to="/purchases" search={{ create: true, material: m.materialId }} />}
                        >
                          <Plus /> Purchase
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </Section>
            ) : null}

            {waiting.length ? (
              <Section title="Orders waiting (oldest first)">
                {waiting.slice(0, ORDERS_SHOWN).map((po) => {
                  const age = daysBetween(toDateOnly(po.poDate) ?? today, today)
                  return (
                    <Row
                      key={po._id}
                      title={
                        <>
                          <Link
                            to="/sales-orders/$orderId"
                            params={{ orderId: po._id }}
                            className="font-medium hover:underline"
                          >
                            {po.poNumber}
                          </Link>{" "}
                          <span className="text-muted-foreground">· {po.companyId.name} ·</span>{" "}
                          <strong className="tabular-nums">
                            {formatTons(po.remainingQuantityTons, { unit: true })}
                          </strong>{" "}
                          <span className="text-muted-foreground">left</span>
                        </>
                      }
                      detail={
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusBadge status={po.displayStatus} />
                          <span>
                            {po.materialId.name} ·{" "}
                            {age === 0 ? "today" : `${formatCount(age)} ${age === 1 ? "day" : "days"}`}
                          </span>
                        </span>
                      }
                      action={canWrite ? <DeliverButton po={po} className="pointer-coarse:h-11" /> : null}
                    />
                  )
                })}
                {openOrderTotal !== undefined && openOrderTotal > ORDERS_SHOWN ? (
                  <li>
                    <Link
                      to="/sales-orders"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      View all {formatCount(openOrderTotal)} open orders <ArrowRight className="size-4" />
                    </Link>
                  </li>
                ) : null}
              </Section>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col divide-y">{children}</ul>
    </section>
  )
}

function Row({
  icon,
  title,
  detail,
  action,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  detail: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <li className={cn("flex min-h-11 items-center gap-3 py-2")}>
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1 text-sm">
        <p className="line-clamp-2">{title}</p>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  )
}
