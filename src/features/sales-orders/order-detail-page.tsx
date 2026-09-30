import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Ban, ClipboardList, Pencil, RotateCcw, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { StatCard } from "@/components/common/stat-card"
import { KeyValueList } from "@/components/common/key-value-list"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { OrderSheet } from "./order-sheet"
import { DeliverButton, OrderProgress } from "./order-parts"
import { isOpenOrder, useOrderLifecycle } from "./order-lifecycle"
import { orderDeliveriesQuery, salesOrderQuery } from "./api"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"
import {
  DASH,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatRate,
  formatTons,
} from "@/lib/format"
import type { SalesPO } from "@/types/api"

export function OrderDetailPage({ orderId, editing }: { orderId: string; editing: boolean }) {
  const navigate = useNavigate({ from: "/sales-orders/$orderId" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const { cancel, reopen } = useOrderLifecycle()
  const { data: po, error, refetch } = useQuery(salesOrderQuery(orderId))

  if (!po) return error ? <ErrorState error={error} onRetry={() => refetch()} /> : null

  const setEditing = (on: boolean) => navigate({ search: { edit: on || undefined } })
  const open = isOpenOrder(po)

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {po.poNumber}
            <StatusBadge status={po.displayStatus} />
          </span>
        }
        description={
          <>
            Order from{" "}
            <Link
              to="/companies/$companyId"
              params={{ companyId: po.companyId._id }}
              className="text-primary hover:underline"
            >
              {po.companyId.name}
            </Link>{" "}
            · {po.materialId.name} · dated {formatDate(po.poDate)}
          </>
        }
        secondaryActions={
          canWrite ? (
            <>
              <Button variant="outline" className="h-10 md:h-9" onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
              {po.lifecycleStatus === "ACTIVE" ? (
                <Button variant="outline" className="h-10 md:h-9" onClick={() => cancel(po)}>
                  <Ban /> Cancel order
                </Button>
              ) : (
                <Button variant="outline" className="h-10 md:h-9" onClick={() => reopen(po)}>
                  <RotateCcw /> Reopen
                </Button>
              )}
            </>
          ) : undefined
        }
        primaryAction={
          canWrite && open ? <DeliverButton po={po} size="default" className="h-10 md:h-9" /> : undefined
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Ordered"
          value={formatTons(po.quantityTons, { unit: true })}
          footnote={`at ${formatRate(po.ratePerTon)}`}
        />
        <StatCard
          label="Delivered"
          icon={<Truck className="size-4" />}
          value={formatTons(po.soldQuantityTons, { unit: true })}
          footnote={<OrderProgress po={po} />}
        />
        <StatCard
          label="Left to deliver"
          icon={<ClipboardList className="size-4" />}
          tone={open ? "warning" : "default"}
          value={formatTons(po.remainingQuantityTons, { unit: true })}
          footnote={
            po.displayStatus === "CANCELLED"
              ? "Cancelled: no more deliveries"
              : open
                ? "Still to send"
                : "Fully delivered"
          }
        />
        <StatCard
          label="Order value"
          value={formatMoneyCompact(po.totalPOAmount)}
          exactValue={formatMoney(po.totalPOAmount)}
          footnote="Ordered tons × current rate"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <DeliveriesCard po={po} canDeliver={canWrite && open} canEdit={canWrite} className="lg:col-span-2" />
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueList
              items={[
                {
                  label: "Buyer",
                  value: (
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: po.companyId._id }}
                      className="text-primary hover:underline"
                    >
                      {po.companyId.name}
                    </Link>
                  ),
                },
                {
                  label: "Material",
                  value: (
                    <Link
                      to="/materials/$materialId"
                      params={{ materialId: po.materialId._id }}
                      className="text-primary hover:underline"
                    >
                      {po.materialId.name}
                    </Link>
                  ),
                },
                { label: "Order date", value: formatDate(po.poDate), numeric: true },
                { label: "Selling rate", value: formatRate(po.ratePerTon), numeric: true },
                {
                  label: "Notes",
                  value: po.notes && <span className="whitespace-pre-line">{po.notes}</span>,
                },
                { label: "Added on", value: formatDateTime(po.createdAt) },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {canWrite ? (
        <OrderSheet
          open={editing}
          orderId={po._id}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

/** Every delivery against this order, with the supplier stock it came from. */
function DeliveriesCard({
  po,
  canDeliver,
  canEdit,
  className,
}: {
  po: SalesPO
  canDeliver: boolean
  canEdit: boolean
  className?: string
}) {
  const { data, error, isPending, refetch } = useQuery(orderDeliveriesQuery(po._id))
  const rows = data?.items ?? []

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Deliveries</CardTitle>
        <CardDescription>Each truck sent against this order and whose stock it used.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {error ? (
          <div className="px-4">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : isPending ? (
          <div className="flex flex-col gap-2 px-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4">
            <EmptyState
              icon={Truck}
              title="No deliveries yet"
              description={`${formatTons(po.remainingQuantityTons, { unit: true })} is waiting to be delivered.`}
              action={canDeliver ? <DeliverButton po={po} size="default" /> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Stock from</TableHead>
                  <TableHead className="text-right">Tons (t)</TableHead>
                  <TableHead className="text-right">Rate (₹/t)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className={canEdit ? undefined : "pr-4"}>Vehicle · Challan</TableHead>
                  {canEdit ? (
                    <TableHead className="w-12 pr-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell className="pl-4 tabular-nums">{formatDate(s.saleDate)}</TableCell>
                    <TableCell>
                      <Link
                        to="/companies/$companyId"
                        params={{ companyId: s.sourceCompanyId._id }}
                        className="hover:underline"
                      >
                        {s.sourceCompanyId.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatTons(s.quantityTons)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(s.poRateAtSale, { symbol: false })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(s.totalAmount, { symbol: false })}
                    </TableCell>
                    <TableCell className={canEdit ? "text-muted-foreground" : "pr-4 text-muted-foreground"}>
                      {[s.vehicleNumber, s.challanNumber].filter(Boolean).join(" · ") || DASH}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit delivery of ${formatDate(s.saleDate)}`}
                          render={<Link to="/deliveries" search={{ edit: s._id }} />}
                        >
                          <Pencil />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
