import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ClipboardList, Pencil, Plus, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/page-header"
import { FilterBar, type FilterChip } from "@/components/common/filter-bar"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { EntityFilter } from "@/components/common/entity-filter"
import { DataTable, type AppColumnDef } from "@/components/common/data-table/data-table"
import { createAppColumnHelper } from "@/components/common/data-table/table-features"
import { EmptyState } from "@/components/common/empty-state"
import { RowActions, type RowAction } from "@/components/common/row-actions"
import { RecordCard } from "@/components/common/record-card"
import { DeliverySheet } from "./delivery-sheet"
import { deliveriesQuery } from "./api"
import type { DeliveriesSearch } from "./search"
import { dashboardQuery } from "@/features/dashboard/api"
import { useEntityOption } from "@/features/lookups/entity"
import { useSession } from "@/features/auth/session"
import { useHighlight } from "@/hooks/use-highlight"
import { can } from "@/lib/permissions"
import { describeRange } from "@/lib/fy"
import { DASH, formatCount, formatDate, formatMoney, formatTons } from "@/lib/format"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import type { Sale } from "@/types/api"

const helper = createAppColumnHelper<Sale>()

const muted = (v?: string) => (v ? v : <span className="text-muted-foreground">{DASH}</span>)

export function DeliveriesPage({ search }: { search: DeliveriesSearch }) {
  const navigate = useNavigate({ from: "/deliveries/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const [highlightId, highlight] = useHighlight()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const filters = {
    from: search.from,
    to: search.to,
    companyId: search.buyer,
    materialId: search.material,
  }
  const query = useQuery(
    deliveriesQuery({ page, limit, search: search.q, sourceCompanyId: search.source, ...filters })
  )
  // Whole-set totals come from the dashboard, which can't narrow by supplier or search text.
  const totalsAvailable = !search.q && !search.source
  const totals = useQuery({ ...dashboardQuery(filters), enabled: totalsAvailable })

  const buyer = useEntityOption("buyer", search.buyer)
  const source = useEntityOption("supplier", search.source)
  const material = useEntityOption("material", search.material)
  const filtered = Boolean(
    search.q || search.from || search.to || search.buyer || search.source || search.material
  )

  const setSearch = (patch: Partial<DeliveriesSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
  const clearAll = () =>
    setSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      buyer: undefined,
      source: undefined,
      material: undefined,
      ...resetPage,
    })
  const openCreate = () => setSearch({ create: true, edit: undefined, poId: undefined })
  const openEdit = (s: Sale) => setSearch({ edit: s._id, create: undefined, poId: undefined })
  const closeSheet = () => setSearch({ create: undefined, edit: undefined, poId: undefined })

  const actionsFor = (s: Sale): RowAction[] => [
    ...(canWrite ? [{ label: "Edit", icon: Pencil, onSelect: () => openEdit(s) }] : []),
    {
      label: "Open order",
      icon: ClipboardList,
      onSelect: () => navigate({ to: "/sales-orders/$orderId", params: { orderId: s.poId._id } }),
    },
  ]

  const columns: AppColumnDef<Sale>[] = helper.columns([
    helper.accessor("saleDate", {
      header: "Date",
      cell: (info) => <span className="tabular-nums">{formatDate(info.getValue())}</span>,
      meta: { headerClassName: "w-28" },
    }),
    helper.accessor((s) => s.poId.poNumber, {
      id: "po",
      header: "PO no.",
      cell: (info) => (
        <Link
          to="/sales-orders/$orderId"
          params={{ orderId: info.row.original.poId._id }}
          className="font-medium whitespace-nowrap hover:underline focus-visible:underline focus-visible:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          {info.getValue()}
        </Link>
      ),
      meta: { label: "PO no." },
    }),
    helper.accessor((s) => s.companyId.name, {
      id: "buyer",
      header: "Buyer",
      meta: { label: "Buyer", className: "max-w-48 truncate" },
    }),
    helper.accessor((s) => s.sourceCompanyId.name, {
      id: "source",
      header: "Stock from",
      meta: { label: "Stock from", className: "max-w-48 truncate" },
    }),
    helper.accessor((s) => s.materialId.name, {
      id: "material",
      header: "Material",
      meta: { label: "Material", className: "max-w-44 truncate" },
    }),
    helper.accessor("quantityTons", {
      header: "Tons (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Tons" },
    }),
    helper.accessor("poRateAtSale", {
      header: "Rate (₹/t)",
      cell: (info) => formatMoney(info.getValue(), { symbol: false }),
      meta: { align: "end", label: "Rate" },
    }),
    helper.accessor("totalAmount", {
      header: "Amount (₹)",
      cell: (info) => <span className="font-medium">{formatMoney(info.getValue(), { symbol: false })}</span>,
      meta: { align: "end", label: "Amount" },
    }),
    helper.accessor("vehicleNumber", {
      header: "Vehicle",
      cell: (info) => <span className="font-mono text-xs">{muted(info.getValue())}</span>,
      meta: { label: "Vehicle" },
    }),
    helper.accessor("challanNumber", {
      header: "Challan",
      cell: (info) => muted(info.getValue()),
      meta: { label: "Challan" },
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => (
        <RowActions
          label={`delivery against ${info.row.original.poId.poNumber}`}
          actions={actionsFor(info.row.original)}
        />
      ),
      meta: { headerClassName: "w-12", className: "w-12 text-right" },
    }),
  ])

  const total = query.data?.meta.total
  const summary =
    total === undefined
      ? null
      : [
          `${formatCount(total)} ${total === 1 ? "delivery" : "deliveries"}`,
          ...(totals.data && totalsAvailable
            ? [
                formatTons(totals.data.sales.quantityTons, { unit: true }),
                formatMoney(totals.data.sales.value),
              ]
            : []),
        ].join(" · ")

  const chip = (id: string, label: string, onRemove: () => void): FilterChip[] => [{ id, label, onRemove }]
  const chips: FilterChip[] = [
    ...(search.from || search.to
      ? chip("dates", describeRange(search.from, search.to), () =>
          setSearch({ from: undefined, to: undefined, ...resetPage })
        )
      : []),
    ...(buyer
      ? chip("buyer", `Buyer: ${buyer.name}`, () => setSearch({ buyer: undefined, ...resetPage }))
      : []),
    ...(source
      ? chip("source", `Stock from: ${source.name}`, () => setSearch({ source: undefined, ...resetPage }))
      : []),
    ...(material
      ? chip("material", `Material: ${material.name}`, () => setSearch({ material: undefined, ...resetPage }))
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Scrap sent to buyers against their orders. Stock goes down when you save a delivery."
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={openCreate}>
              <Plus /> Record delivery
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "Vehicle or challan no.",
        }}
        chips={chips}
        onClearAll={clearAll}
      >
        <DateRangePicker
          from={search.from}
          to={search.to}
          onChange={(r) => setSearch({ from: r?.from, to: r?.to, ...resetPage })}
        />
        <EntityFilter
          kind="buyer"
          value={search.buyer}
          allLabel="All buyers"
          onChange={(id) => setSearch({ buyer: id, ...resetPage })}
        />
        <EntityFilter
          kind="supplier"
          label="Stock from"
          value={search.source}
          allLabel="Stock from any supplier"
          onChange={(id) => setSearch({ source: id, ...resetPage })}
        />
        <EntityFilter
          kind="material"
          value={search.material}
          allLabel="All materials"
          onChange={(id) => setSearch({ material: id, ...resetPage })}
        />
      </FilterBar>

      <DataTable
        tableId="deliveries"
        label="Deliveries"
        columns={columns}
        defaultHidden={["poRateAtSale", "challanNumber"]}
        data={query.data?.items}
        getRowId={(s) => s._id}
        total={total}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={canWrite ? openEdit : undefined}
        highlightRowId={highlightId}
        summary={summary}
        renderMobileCard={(s) => (
          <RecordCard
            title={s.companyId.name}
            actions={<RowActions label={`delivery against ${s.poId.poNumber}`} actions={actionsFor(s)} />}
            onOpen={canWrite ? () => openEdit(s) : undefined}
            footer={[formatDate(s.saleDate), s.poId.poNumber, s.vehicleNumber, s.challanNumber]
              .filter(Boolean)
              .join(" · ")}
          >
            <div className="text-muted-foreground">
              {s.materialId.name} · from {s.sourceCompanyId.name}
            </div>
            <div className="flex items-baseline justify-between tabular-nums">
              <span>{formatTons(s.quantityTons, { unit: true })}</span>
              <span className="font-semibold">{formatMoney(s.totalAmount)}</span>
            </div>
          </RecordCard>
        )}
        empty={
          filtered ? (
            <EmptyState
              kind="no-results"
              title="No deliveries match"
              description="Try another date range, buyer or supplier, or clear the filters."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Truck}
              title="No deliveries yet"
              description="When scrap goes out to a buyer, record it here. Stock updates automatically."
              action={
                canWrite ? (
                  <Button onClick={openCreate}>
                    <Plus /> Record delivery
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      {canWrite ? (
        <DeliverySheet
          open={Boolean(search.create || search.edit)}
          deliveryId={search.edit}
          poId={search.create ? search.poId : undefined}
          onClose={closeSheet}
          onSaved={(delivery, { another }) => {
            highlight(delivery._id)
            // "Save & add another" keeps the sheet open for the next truck.
            if (!another) closeSheet()
          }}
        />
      ) : null}
    </>
  )
}
