import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownToLine, Pencil, Plus, Repeat } from "lucide-react"
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
import { PurchaseSheet } from "./purchase-sheet"
import { purchasesQuery } from "./api"
import type { PurchasesSearch } from "./search"
import { dashboardQuery } from "@/features/dashboard/api"
import { useEntityOption } from "@/features/lookups/entity"
import { useSession } from "@/features/auth/session"
import { useHighlight } from "@/hooks/use-highlight"
import { can } from "@/lib/permissions"
import { describeRange } from "@/lib/fy"
import { DASH, formatCount, formatDate, formatMoney, formatTons } from "@/lib/format"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import type { Purchase } from "@/types/api"

const helper = createAppColumnHelper<Purchase>()

const muted = (v?: string) => (v ? v : <span className="text-muted-foreground">{DASH}</span>)

export function PurchasesPage({ search }: { search: PurchasesSearch }) {
  const navigate = useNavigate({ from: "/purchases/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const [highlightId, highlight] = useHighlight()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const filters = {
    from: search.from,
    to: search.to,
    companyId: search.supplier,
    materialId: search.material,
  }
  const query = useQuery(purchasesQuery({ page, limit, search: search.q, ...filters }))
  // Totals for the whole filtered set come from the server (a page total would mislead).
  const totals = useQuery({ ...dashboardQuery(filters), enabled: !search.q })

  const supplier = useEntityOption("supplier", search.supplier)
  const material = useEntityOption("material", search.material)
  const filtered = Boolean(search.q || search.from || search.to || search.supplier || search.material)

  const setSearch = (patch: Partial<PurchasesSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })
  const clearAll = () =>
    setSearch({
      q: undefined,
      from: undefined,
      to: undefined,
      supplier: undefined,
      material: undefined,
      ...resetPage,
    })
  const closeSheet = () => setSearch({ create: undefined, edit: undefined, repeat: undefined })

  const actionsFor = (p: Purchase): RowAction[] =>
    canWrite
      ? [
          {
            label: "Edit",
            icon: Pencil,
            onSelect: () => setSearch({ edit: p._id, create: undefined, repeat: undefined }),
          },
          {
            label: "Repeat purchase",
            icon: Repeat,
            onSelect: () => setSearch({ create: true, repeat: p._id, edit: undefined }),
          },
        ]
      : []

  const columns: AppColumnDef<Purchase>[] = helper.columns([
    helper.accessor("purchaseDate", {
      header: "Date",
      cell: (info) => <span className="tabular-nums">{formatDate(info.getValue())}</span>,
      meta: { headerClassName: "w-28" },
    }),
    helper.accessor((p) => p.companyId.name, {
      id: "supplier",
      header: "Supplier",
      cell: (info) =>
        canWrite ? (
          <button
            type="button"
            className="max-w-56 truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
            onClick={() => setSearch({ edit: info.row.original._id })}
          >
            {info.getValue()}
          </button>
        ) : (
          <span className="font-medium">{info.getValue()}</span>
        ),
    }),
    helper.accessor((p) => p.materialId.name, {
      id: "material",
      header: "Material",
      meta: { label: "Material", className: "max-w-44 truncate" },
    }),
    helper.accessor("quantityTons", {
      header: "Tons (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Tons" },
    }),
    helper.accessor("ratePerTon", {
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
    helper.accessor("invoiceNumber", {
      header: "Invoice",
      cell: (info) => muted(info.getValue()),
      meta: { label: "Invoice" },
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => (
        <RowActions
          label={`purchase from ${info.row.original.companyId.name}`}
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
          `${formatCount(total)} ${total === 1 ? "purchase" : "purchases"}`,
          ...(totals.data && !search.q
            ? [
                formatTons(totals.data.purchases.quantityTons, { unit: true }),
                formatMoney(totals.data.purchases.value),
              ]
            : []),
        ].join(" · ")

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
        title="Purchases"
        description="Scrap bought from suppliers. Stock goes up when you save a purchase."
        primaryAction={
          canWrite ? (
            <Button
              className="h-10 md:h-9"
              onClick={() => setSearch({ create: true, edit: undefined, repeat: undefined })}
            >
              <Plus /> New purchase
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "Vehicle or invoice no.",
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
      </FilterBar>

      <DataTable
        tableId="purchases"
        label="Purchases"
        columns={columns}
        data={query.data?.items}
        getRowId={(p) => p._id}
        total={total}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={canWrite ? (p) => setSearch({ edit: p._id }) : undefined}
        highlightRowId={highlightId}
        summary={summary}
        renderMobileCard={(p) => (
          <RecordCard
            title={p.companyId.name}
            actions={<RowActions label={`purchase from ${p.companyId.name}`} actions={actionsFor(p)} />}
            onOpen={canWrite ? () => setSearch({ edit: p._id }) : undefined}
            footer={[formatDate(p.purchaseDate), p.vehicleNumber, p.invoiceNumber]
              .filter(Boolean)
              .join(" · ")}
          >
            <div className="text-muted-foreground">{p.materialId.name}</div>
            <div className="flex items-baseline justify-between tabular-nums">
              <span>{formatTons(p.quantityTons, { unit: true })}</span>
              <span className="font-semibold">{formatMoney(p.totalAmount)}</span>
            </div>
          </RecordCard>
        )}
        empty={
          filtered ? (
            <EmptyState
              kind="no-results"
              title="No purchases match"
              description="Try another date range or supplier, or clear the filters."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ArrowDownToLine}
              title="No purchases yet"
              description="Record each truck of scrap you buy. Stock goes up as you save."
              action={
                canWrite ? (
                  <Button onClick={() => setSearch({ create: true })}>
                    <Plus /> Record your first purchase
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      {canWrite ? (
        <PurchaseSheet
          open={Boolean(search.create || search.edit)}
          purchaseId={search.edit}
          repeatId={search.create ? search.repeat : undefined}
          // A new purchase opened for a material (from "Buy needed") starts with it chosen, once its
          // name has loaded.
          material={
            search.create && !search.repeat && material && material.name !== "…" ? material : undefined
          }
          onClose={closeSheet}
          onSaved={(purchase, { another }) => {
            highlight(purchase._id)
            // "Save & add another" keeps the sheet open for the next truck.
            if (!another) closeSheet()
            else if (search.repeat) setSearch({ repeat: undefined })
          }}
        />
      ) : null}
    </>
  )
}
