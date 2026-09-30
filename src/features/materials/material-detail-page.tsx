import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ClipboardList, PackageOpen, Pencil, Power, PowerOff, TriangleAlert, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { useConfirm } from "@/components/common/confirm-dialog"
import { materialQuery, useSaveMaterial } from "./api"
import { MaterialSheet } from "./material-sheet"
import { dashboardQuery } from "@/features/dashboard/api"
import { sourceStockQuery } from "@/features/reports/api"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"
import { isNegative, isPositive, isZero } from "@/lib/decimal"
import { formatTons, formatTonsCompact } from "@/lib/format"
import { notify } from "@/lib/notify"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { Material } from "@/types/api"

export function MaterialDetailPage({ materialId, editing }: { materialId: string; editing: boolean }) {
  const navigate = useNavigate({ from: "/materials/$materialId" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const confirm = useConfirm()
  const save = useSaveMaterial()
  const { data: material, error, refetch } = useQuery(materialQuery(materialId))
  const position = useQuery(dashboardQuery({ materialId }))
  const row = position.data?.materials[0]

  if (!material) return error ? <ErrorState error={error} onRetry={() => refetch()} /> : null

  const setEditing = (on: boolean) => navigate({ search: { edit: on || undefined } })

  const toggleActive = async () => {
    if (!material.isActive) {
      try {
        await save.mutateAsync({ id: material._id, input: { isActive: true } })
        notify.success("Material reactivated", { description: material.name })
      } catch (err) {
        notify.error("Couldn't reactivate the material", { description: errorMessage(err) })
      }
      return
    }
    const ok = await confirm({
      title: `Deactivate ${material.name}?`,
      description:
        "It will no longer appear when you record purchases or orders. Its stock and past records stay unchanged. You can reactivate it later.",
      cancelLabel: "Keep active",
      confirmLabel: "Deactivate",
      destructive: true,
      onConfirm: () => save.mutateAsync({ id: material._id, input: { isActive: false } }),
    })
    if (ok) notify.success("Material deactivated", { description: material.name })
  }

  const buyNeeded = row?.purchaseRequiredTons

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {material.name}
            {!material.isActive ? <StatusBadge status="INACTIVE" /> : null}
          </span>
        }
        description="Stock in the yard today and where it came from."
        secondaryActions={
          canWrite ? (
            <Button variant="outline" className="h-10 md:h-9" onClick={toggleActive}>
              {material.isActive ? <PowerOff /> : <Power />}
              {material.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          ) : undefined
        }
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          ) : undefined
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="In yard"
          icon={<PackageOpen className="size-4" />}
          value={formatTonsCompact(material.currentStockTons)}
          exactValue={formatTons(material.currentStockTons, { unit: true })}
          footnote={
            isNegative(material.currentStockTons)
              ? "Below zero: check recent records"
              : "Opening stock + bought − delivered"
          }
        />
        <StatCard
          label="Open orders"
          icon={<ClipboardList className="size-4" />}
          loading={position.isPending}
          value={formatTonsCompact(row?.remainingPOQuantityTons ?? "0")}
          exactValue={formatTons(row?.remainingPOQuantityTons ?? "0", { unit: true })}
          footnote="Left to deliver on open sales orders"
        />
        <StatCard
          label="Buy needed"
          icon={<TriangleAlert className="size-4" />}
          tone={buyNeeded && isPositive(buyNeeded) ? "warning" : "default"}
          loading={position.isPending}
          value={formatTonsCompact(buyNeeded ?? "0")}
          exactValue={formatTons(buyNeeded ?? "0", { unit: true })}
          footnote={
            buyNeeded && isPositive(buyNeeded)
              ? "Open orders are more than the yard holds"
              : "Yard stock covers open orders"
          }
        />
        <StatCard
          label="Opening stock"
          value={formatTonsCompact(material.openingStockTons)}
          exactValue={formatTons(material.openingStockTons, { unit: true })}
          footnote="Before the first recorded purchase"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <StockBySupplierCard material={material} className="lg:col-span-2" />
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {material.notes ? (
              <p className="text-sm whitespace-pre-line">{material.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {canWrite ? (
        <MaterialSheet
          open={editing}
          materialId={material._id}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

/** Which suppliers this material can still be delivered from. */
function StockBySupplierCard({ material, className }: { material: Material; className?: string }) {
  const { data, error, isPending, refetch } = useQuery(sourceStockQuery({ materialId: material._id }))
  const rows = [...(data ?? [])].sort((a, b) => Number(b.availableTons) - Number(a.availableTons))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Stock by supplier</CardTitle>
        <CardDescription>
          A delivery of {material.name} must say which supplier&apos;s stock it uses; it can take only what is
          available here.
          {!isZero(material.openingStockTons)
            ? ` Opening stock (${formatTons(material.openingStockTons, { unit: true })}) has no supplier, so it isn't listed.`
            : ""}
        </CardDescription>
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
              icon={Warehouse}
              title="Not bought from any supplier yet"
              description={`Purchases of ${material.name} will show here by supplier.`}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Supplier</TableHead>
                <TableHead className="text-right">Bought (t)</TableHead>
                <TableHead className="text-right">Delivered (t)</TableHead>
                <TableHead className="pr-4 text-right">Available (t)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.sourceCompanyId}>
                  <TableCell className="pl-4 font-medium">
                    <Link
                      to="/companies/$companyId"
                      params={{ companyId: r.sourceCompanyId }}
                      className="hover:underline"
                    >
                      {r.sourceCompanyName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatTons(r.purchasedTons)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTons(r.usedForSalesTons)}</TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 text-right font-medium tabular-nums",
                      isNegative(r.availableTons) && "text-destructive",
                      isZero(r.availableTons) && "font-normal text-muted-foreground"
                    )}
                  >
                    {formatTons(r.availableTons)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
