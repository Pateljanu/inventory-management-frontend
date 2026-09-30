import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Ban, ClipboardList, Pencil, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/page-header"
import { FilterBar, type FilterChip } from "@/components/common/filter-bar"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { EntityFilter } from "@/components/common/entity-filter"
import { DataTable, type AppColumnDef } from "@/components/common/data-table/data-table"
import { createAppColumnHelper } from "@/components/common/data-table/table-features"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { RowActions, type RowAction } from "@/components/common/row-actions"
import { RecordCard } from "@/components/common/record-card"
import { OrderSheet } from "./order-sheet"
import { DeliverButton, OrderProgress } from "./order-parts"
import { isOpenOrder, useOrderLifecycle } from "./order-lifecycle"
import { salesOrdersQuery } from "./api"
import { ORDER_VIEWS, type OrderView, type SalesOrdersSearch } from "./search"
import { useEntityOption } from "@/features/lookups/entity"
import { useSession } from "@/features/auth/session"
import { useHighlight } from "@/hooks/use-highlight"
import { can } from "@/lib/permissions"
import { describeRange } from "@/lib/fy"
import { formatCount, formatDate, formatMoney, formatTons } from "@/lib/format"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import { cn } from "@/lib/utils"
import type { SalesPO } from "@/types/api"

const helper = createAppColumnHelper<SalesPO>()

export function OrdersPage({ search }: { search: SalesOrdersSearch }) {
  const navigate = useNavigate({ from: "/sales-orders/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const { cancel, reopen } = useOrderLifecycle()
  const [highlightId, highlight] = useHighlight()

  const view: OrderView = search.view ?? "open"
  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const query = useQuery(
    salesOrdersQuery({
      page,
      limit,
      search: search.q,
      from: search.from,
      to: search.to,
      companyId: search.buyer,
      materialId: search.material,
      status: ORDER_VIEWS[view].status,
    })
  )

  const buyer = useEntityOption("buyer", search.buyer)
  const material = useEntityOption("material", search.material)
  const filtered = Boolean(search.q || search.from || search.to || search.buyer || search.material)

  const setSearch = (patch: Partial<SalesOrdersSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
  const clearAll = () =>
    setSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      buyer: undefined,
      material: undefined,
      ...resetPage,
    })
  const openDetail = (po: SalesPO) => navigate({ to: "/sales-orders/$orderId", params: { orderId: po._id } })

  const actionsFor = (po: SalesPO): RowAction[] =>
    canWrite
      ? [
          { label: "Edit", icon: Pencil, onSelect: () => setSearch({ edit: po._id, create: undefined }) },
          po.lifecycleStatus === "ACTIVE"
            ? {
                label: "Cancel order",
                icon: Ban,
                onSelect: () => void cancel(po),
                destructive: true,
                separated: true,
              }
            : { label: "Reopen order", icon: RotateCcw, onSelect: () => void reopen(po), separated: true },
        ]
      : []

  const columns: AppColumnDef<SalesPO>[] = helper.columns([
    helper.accessor("poNumber", {
      header: "PO no.",
      cell: (info) => (
        <Link
          to="/sales-orders/$orderId"
          params={{ orderId: info.row.original._id }}
          className="font-medium whitespace-nowrap hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    helper.accessor("poDate", {
      header: "Date",
      cell: (info) => <span className="tabular-nums">{formatDate(info.getValue())}</span>,
      meta: { label: "Date" },
    }),
    helper.accessor((po) => po.companyId.name, {
      id: "buyer",
      header: "Buyer",
      meta: { label: "Buyer", className: "max-w-48 truncate" },
    }),
    helper.accessor((po) => po.materialId.name, {
      id: "material",
      header: "Material",
      meta: { label: "Material", className: "max-w-40 truncate" },
    }),
    helper.accessor("quantityTons", {
      header: "Ordered (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Ordered" },
    }),
    helper.accessor("soldQuantityTons", {
      header: "Delivered (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Delivered" },
    }),
    helper.accessor("remainingQuantityTons", {
      header: "Left (t)",
      cell: (info) => <span className="font-medium">{formatTons(info.getValue())}</span>,
      meta: { align: "end", label: "Left to deliver" },
    }),
    helper.display({
      id: "progress",
      header: "Progress",
      cell: (info) => <OrderProgress po={info.row.original} />,
      meta: { label: "Progress", headerClassName: "w-36" },
    }),
    helper.accessor("ratePerTon", {
      header: "Rate (₹/t)",
      cell: (info) => formatMoney(info.getValue(), { symbol: false }),
      meta: { align: "end", label: "Rate" },
    }),
    helper.accessor("displayStatus", {
      header: "Status",
      cell: (info) => <StatusBadge status={info.getValue()} />,
      meta: { label: "Status" },
    }),
    helper.display({
      id: "deliver",
      header: () => <span className="sr-only">Deliver</span>,
      cell: (info) =>
        canWrite && isOpenOrder(info.row.original) ? <DeliverButton po={info.row.original} /> : null,
      meta: { className: "w-24" },
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => (
        <RowActions label={`order ${info.row.original.poNumber}`} actions={actionsFor(info.row.original)} />
      ),
      meta: { headerClassName: "w-12", className: "w-12 text-right" },
    }),
  ])

  const total = query.data?.meta.total
  const chips: FilterChip[] = [
    ...(search.from || search.to
      ? [
          {
            id: "dates",
            label: describeRange(search.from, search.to),
            onRemove: () => setSearch({ from: undefined, to: undefined, ...resetPage }),
          },
        ]
      : []),
    ...(buyer
      ? [
          {
            id: "buyer",
            label: `Buyer: ${buyer.name}`,
            onRemove: () => setSearch({ buyer: undefined, ...resetPage }),
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
        title="Sales Orders"
        description="Orders from buyers. Record deliveries against them."
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={() => setSearch({ create: true, edit: undefined })}>
              <Plus /> New sales order
            </Button>
          ) : undefined
        }
      />

      <div
        role="group"
        aria-label="Quick views"
        className="-mb-2 flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit"
      >
        {(Object.keys(ORDER_VIEWS) as OrderView[]).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setSearch({ view: v === "open" ? undefined : v, ...resetPage })}
            className={cn(
              "h-9 shrink-0 rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground md:h-8",
              view === v && "bg-background text-foreground shadow-sm"
            )}
          >
            {ORDER_VIEWS[v].label}
          </button>
        ))}
      </div>

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "PO number",
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
          kind="material"
          value={search.material}
          allLabel="All materials"
          onChange={(id) => setSearch({ material: id, ...resetPage })}
        />
      </FilterBar>

      <DataTable
        tableId="sales-orders"
        label="Sales orders"
        columns={columns}
        defaultHidden={["soldQuantityTons", "ratePerTon"]}
        data={query.data?.items}
        getRowId={(po) => po._id}
        total={total}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={openDetail}
        highlightRowId={highlightId}
        summary={
          total !== undefined
            ? `${formatCount(total)} ${ORDER_VIEWS[view].label.toLowerCase()} ${total === 1 ? "order" : "orders"}`.replace(
                "all ",
                ""
              )
            : null
        }
        renderMobileCard={(po) => (
          <RecordCard
            title={
              <Link to="/sales-orders/$orderId" params={{ orderId: po._id }} className="hover:underline">
                {po.poNumber}
              </Link>
            }
            badge={<StatusBadge status={po.displayStatus} />}
            actions={<RowActions label={`order ${po.poNumber}`} actions={actionsFor(po)} />}
            onOpen={() => openDetail(po)}
            footer={`${po.companyId.name} · ${formatDate(po.poDate)}`}
          >
            <div className="text-muted-foreground">{po.materialId.name}</div>
            <div className="flex items-baseline justify-between tabular-nums">
              <span>
                <span className="font-semibold">{formatTons(po.remainingQuantityTons, { unit: true })}</span>{" "}
                <span className="text-muted-foreground">left of {formatTons(po.quantityTons)}</span>
              </span>
            </div>
            <OrderProgress po={po} />
            {canWrite && isOpenOrder(po) ? (
              <DeliverButton po={po} size="default" className="mt-1 h-11 w-full" />
            ) : null}
          </RecordCard>
        )}
        empty={
          filtered ? (
            <EmptyState
              kind="no-results"
              title="No orders match"
              description="Try another date range or buyer, or clear the filters."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : view === "open" ? (
            <EmptyState
              kind="all-done"
              title="No orders waiting"
              description="Every order is delivered or cancelled. New orders from buyers appear here."
              action={
                canWrite ? (
                  <Button variant="outline" onClick={() => setSearch({ create: true })}>
                    <Plus /> New sales order
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title={`No ${ORDER_VIEWS[view].label.toLowerCase()} orders`}
              description="Orders move here as deliveries are recorded."
            />
          )
        }
      />

      {canWrite ? (
        <OrderSheet
          open={Boolean(search.create || search.edit)}
          orderId={search.edit}
          onClose={() => setSearch({ create: undefined, edit: undefined })}
          onSaved={(po) => {
            setSearch({ create: undefined, edit: undefined })
            highlight(po._id)
          }}
        />
      ) : null}
    </>
  )
}
