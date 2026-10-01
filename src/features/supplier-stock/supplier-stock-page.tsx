import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useConfirm } from "@/components/common/confirm-dialog"
import { PageHeader } from "@/components/common/page-header"
import { FilterBar, type FilterChip } from "@/components/common/filter-bar"
import { EntityFilter } from "@/components/common/entity-filter"
import { DateInput } from "@/components/common/form/date-input"
import { DataTable, type AppColumnDef } from "@/components/common/data-table/data-table"
import { createAppColumnHelper } from "@/components/common/data-table/table-features"
import { EmptyState } from "@/components/common/empty-state"
import { RecordCard } from "@/components/common/record-card"
import { sourceStockQuery } from "@/features/reports/api"
import { fetchSettlePreview, useSettlePool } from "@/features/purchases/api"
import { useSession } from "@/features/auth/session"
import { useEntityOption } from "@/features/lookups/entity"
import { isPositive, percentOf, plus, toBig } from "@/lib/decimal"
import { businessToday } from "@/lib/dates"
import { errorMessage } from "@/lib/errors"
import { DASH, formatCount, formatDate, formatMoney, formatRate, formatTons } from "@/lib/format"
import { notify } from "@/lib/notify"
import { can } from "@/lib/permissions"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import { cn } from "@/lib/utils"
import type { SupplierStockSearch } from "./search"
import type { SettlePlan, SourceStockRow } from "@/types/api"

const helper = createAppColumnHelper<SourceStockRow>()

/** How much of what was bought from a supplier is still unused: a bar plus "35% left". */
function LeftBar({ row }: { row: SourceStockRow }) {
  const left = Math.max(0, Math.min(100, percentOf(row.availableTons, row.purchasedTons)))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${left}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(left)}% left</span>
    </div>
  )
}

/** The confirm box of a settle: what is left and exactly which purchases change. */
function SettleSummary({ plan }: { plan: SettlePlan }) {
  return (
    <div className="space-y-3">
      <p>
        {formatTons(plan.leftTons, { unit: true })} is still shown as left. Settling sets the purchase to what
        was actually delivered ({formatTons(plan.usedTons, { unit: true })}), so nothing is left. The rate
        stays the same; the amount follows the tons.
      </p>
      <ul className="max-h-60 divide-y overflow-y-auto rounded-md border text-foreground">
        {plan.changes.map((c) => (
          <li key={c.purchaseId} className="grid gap-0.5 px-3 py-2 tabular-nums">
            <span className="text-xs text-muted-foreground">
              {[formatDate(c.purchaseDate), c.invoiceNumber, c.vehicleNumber, formatRate(c.ratePerTon)]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span>
              {formatTons(c.fromTons)} → <strong>{formatTons(c.toTons, { unit: true })}</strong>
            </span>
            <span>
              {formatMoney(c.fromAmount)} → <strong>{formatMoney(c.toAmount)}</strong>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Stock by the supplier it was bought from: bought, used by deliveries, and still available. A
 * delivery can only draw on a supplier's available stock, so this answers "whose scrap can I send?".
 */
export function SupplierStockPage({ search }: { search: SupplierStockSearch }) {
  const navigate = useNavigate({ from: "/supplier-stock/" })
  const today = businessToday()
  const asOf = search.asOf && search.asOf < today ? search.asOf : undefined
  const query = useQuery(
    sourceStockQuery({ asOf, sourceCompanyId: search.supplier, materialId: search.material })
  )
  const supplier = useEntityOption("supplier", search.supplier)
  const material = useEntityOption("material", search.material)
  const { user } = useSession()
  const confirm = useConfirm()
  const settlePool = useSettlePool()
  const [preparing, setPreparing] = useState<string | null>(null)
  // Settling works on today's stock, so it is offered only on today's view.
  const canSettle = can(user, "write") && !asOf
  const rowKey = (r: SourceStockRow) => `${r.sourceCompanyId}:${r.materialId}`

  /** Shows exactly which purchases change, then trims them to what was delivered. */
  const settle = async (row: SourceStockRow) => {
    const pool = { companyId: row.sourceCompanyId, materialId: row.materialId }
    const name = `${row.sourceCompanyName ?? "Supplier"} · ${row.materialName ?? "material"}`
    let plan: SettlePlan
    setPreparing(rowKey(row))
    try {
      plan = await fetchSettlePreview(pool)
    } catch (error) {
      notify.error("Could not prepare the settle", { description: errorMessage(error) })
      return
    } finally {
      setPreparing(null)
    }
    if (!plan.changes.length) {
      notify.info("Nothing left to settle", { description: `${name} has no stock left.` })
      return
    }
    const done = await confirm({
      title: `Settle ${name}?`,
      description: <SettleSummary plan={plan} />,
      confirmLabel: `Settle ${formatTons(plan.leftTons, { unit: true })}`,
      cancelLabel: "Keep as is",
      onConfirm: () => settlePool.mutateAsync(pool),
    })
    if (done) {
      const count = plan.changes.length
      notify.success(`${name} settled`, {
        description: `${formatTons(plan.leftTons, { unit: true })} taken off ${count} ${count === 1 ? "purchase" : "purchases"}.`,
      })
    }
  }

  const settleButton = (row: SourceStockRow) =>
    isPositive(row.availableTons) ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="pointer-coarse:h-11"
        disabled={preparing !== null}
        aria-label={`Settle ${row.sourceCompanyName ?? "supplier"} ${row.materialName ?? ""}`.trim()}
        onClick={() => void settle(row)}
      >
        {preparing === rowKey(row) ? <Spinner /> : null}
        Settle
      </Button>
    ) : null

  const setSearch = (patch: Partial<SupplierStockSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
  const clearAll = () =>
    setSearch({
      q: undefined,
      asOf: undefined,
      supplier: undefined,
      material: undefined,
      used: undefined,
      ...resetPage,
    })

  // The report is small (supplier × material), so text search, the used-up toggle and paging
  // happen here.
  const needle = search.q?.toLowerCase()
  const rows = (query.data ?? []).filter(
    (r) =>
      (search.used || isPositive(r.availableTons)) &&
      (!needle || `${r.sourceCompanyName} ${r.materialName}`.toLowerCase().includes(needle))
  )
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const pageRows = rows.slice((page - 1) * limit, page * limit)
  const available = rows.reduce((sum, r) => plus(sum, r.availableTons), toBig(0)).toFixed(3)
  const filtered = Boolean(search.q || search.asOf || search.supplier || search.material)

  const columns: AppColumnDef<SourceStockRow>[] = helper.columns([
    helper.accessor("sourceCompanyName", {
      header: "Supplier",
      cell: (info) => (
        <Link
          to="/companies/$companyId"
          params={{ companyId: info.row.original.sourceCompanyId }}
          className="font-medium hover:underline"
        >
          {info.getValue() ?? DASH}
        </Link>
      ),
      meta: { className: "max-w-56 truncate" },
    }),
    helper.accessor("materialName", {
      header: "Material",
      cell: (info) => (
        <Link
          to="/materials/$materialId"
          params={{ materialId: info.row.original.materialId }}
          className="hover:underline"
        >
          {info.getValue() ?? DASH}
        </Link>
      ),
      meta: { label: "Material", className: "max-w-48 truncate" },
    }),
    helper.accessor("purchasedTons", {
      header: "Bought (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Bought" },
    }),
    helper.accessor("usedForSalesTons", {
      header: "Used for deliveries (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Used for deliveries" },
    }),
    helper.accessor("availableTons", {
      header: "Available (t)",
      cell: (info) => <span className="font-semibold">{formatTons(info.getValue())}</span>,
      meta: { align: "end", label: "Available" },
    }),
    helper.display({
      id: "left",
      header: "Left",
      cell: (info) => <LeftBar row={info.row.original} />,
      meta: { label: "Share left", headerClassName: "w-36" },
    }),
    ...(canSettle
      ? [
          helper.display({
            id: "settle",
            header: () => <span className="sr-only">Settle</span>,
            cell: (info) => settleButton(info.row.original),
            meta: { label: "Settle", align: "end", headerClassName: "w-24" },
          }),
        ]
      : []),
  ])

  const chips: FilterChip[] = [
    ...(asOf
      ? [
          {
            id: "asOf",
            label: `On ${formatDate(asOf)}`,
            onRemove: () => setSearch({ asOf: undefined, ...resetPage }),
          },
        ]
      : []),
    ...(supplier
      ? [
          {
            id: "supplier",
            label: `Supplier: ${supplier.name}`,
            onRemove: () => setSearch({ supplier: undefined, ...resetPage }),
          },
        ]
      : []),
    ...(material
      ? [
          {
            id: "material",
            label: `Material: ${material.name}`,
            onRemove: () => setSearch({ material: undefined, ...resetPage }),
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Supplier stock"
        description={`Stock bought from each supplier that deliveries haven't used yet, ${
          asOf ? `on ${formatDate(asOf)}` : "today"
        }. A delivery can only use what is available here.`}
      />

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "Supplier or material",
        }}
        chips={chips}
        onClearAll={clearAll}
      >
        <DateInput
          aria-label="Stock on date"
          value={asOf ?? today}
          max={today}
          onChange={(d) => setSearch({ asOf: d === today ? undefined : d, ...resetPage })}
        />
        <EntityFilter
          kind="supplier"
          value={search.supplier}
          allLabel="All suppliers"
          onChange={(id) => setSearch({ supplier: id, ...resetPage })}
        />
        <EntityFilter
          kind="material"
          value={search.material}
          allLabel="All materials"
          onChange={(id) => setSearch({ material: id, ...resetPage })}
        />
        <Button
          type="button"
          variant="outline"
          aria-pressed={Boolean(search.used)}
          className={cn("h-11 md:h-9", search.used && "border-primary bg-accent text-accent-foreground")}
          onClick={() => setSearch({ used: search.used ? undefined : true, ...resetPage })}
        >
          Include used up
        </Button>
      </FilterBar>

      <DataTable
        tableId="supplier-stock"
        label="Supplier stock"
        columns={columns}
        data={query.data ? pageRows : undefined}
        getRowId={rowKey}
        total={query.data ? rows.length : undefined}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        summary={
          query.data
            ? `${formatCount(rows.length)} supplier ${rows.length === 1 ? "stock" : "stocks"} · ${formatTons(available, { unit: true })} available`
            : null
        }
        renderMobileCard={(r) => (
          <RecordCard
            title={
              <Link
                to="/companies/$companyId"
                params={{ companyId: r.sourceCompanyId }}
                className="hover:underline"
              >
                {r.sourceCompanyName}
              </Link>
            }
            footer={`Bought ${formatTons(r.purchasedTons, { unit: true })} · used ${formatTons(r.usedForSalesTons, { unit: true })}`}
            actions={canSettle ? settleButton(r) : undefined}
          >
            <div className="text-muted-foreground">{r.materialName}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold tabular-nums">
                {formatTons(r.availableTons, { unit: true })} available
              </span>
              <LeftBar row={r} />
            </div>
          </RecordCard>
        )}
        empty={
          filtered || (query.data?.length ?? 0) > 0 ? (
            <EmptyState
              kind="no-results"
              title="No supplier stock matches"
              description={
                search.used
                  ? "Try another supplier, material or date, or clear the filters."
                  : "Nothing is left here. Turn on “Include used up” to see stock that was used."
              }
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Warehouse}
              title="No supplier stock yet"
              description="Each purchase adds stock under its supplier; deliveries use it up."
            />
          )
        }
      />
    </>
  )
}
