import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Layers, Pencil, Plus, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/page-header"
import { FilterBar } from "@/components/common/filter-bar"
import { DataTable, type AppColumnDef } from "@/components/common/data-table/data-table"
import { createAppColumnHelper } from "@/components/common/data-table/table-features"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { RowActions, type RowAction } from "@/components/common/row-actions"
import { RecordCard } from "@/components/common/record-card"
import { KeyValueList } from "@/components/common/key-value-list"
import { useConfirm } from "@/components/common/confirm-dialog"
import { materialsQuery, useSaveMaterial } from "./api"
import { MaterialSheet } from "./material-sheet"
import type { MaterialsSearch } from "./search"
import { dashboardQuery } from "@/features/dashboard/api"
import { useSession } from "@/features/auth/session"
import { useHighlight } from "@/hooks/use-highlight"
import { can } from "@/lib/permissions"
import { isPositive } from "@/lib/decimal"
import { formatCount, formatTons } from "@/lib/format"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import { notify } from "@/lib/notify"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { DashboardMaterialRow, Material } from "@/types/api"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

type Row = Material & { position?: DashboardMaterialRow }

const helper = createAppColumnHelper<Row>()

/** "Buy needed" is the most actionable number: red with a sign when positive, muted zero otherwise. */
function BuyNeeded({ value }: { value?: string }) {
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn(isPositive(value) ? "font-medium text-destructive" : "text-muted-foreground")}>
      {formatTons(value)}
    </span>
  )
}

export function MaterialsPage({ search }: { search: MaterialsSearch }) {
  const navigate = useNavigate({ from: "/materials/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const confirm = useConfirm()
  const save = useSaveMaterial()
  const [highlightId, highlight] = useHighlight()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const query = useQuery(
    materialsQuery({
      page,
      limit,
      search: search.q,
      isActive: search.status === undefined ? undefined : search.status === "active",
    })
  )
  // Stock positions as of today (the list endpoint has names and settings only).
  const positions = useQuery(dashboardQuery({}))
  const byId = new Map(positions.data?.materials.map((m) => [m.materialId, m]))
  const rows: Row[] | undefined = query.data?.items.map((m) => ({ ...m, position: byId.get(m._id) }))
  const filtered = Boolean(search.q || search.status)

  const setSearch = (patch: Partial<MaterialsSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })

  const toggleActive = async (material: Material) => {
    if (!material.isActive) {
      try {
        await save.mutateAsync({ id: material._id, input: { isActive: true } })
        notify.success("Material reactivated", { description: material.name })
        highlight(material._id)
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

  const actionsFor = (m: Material): RowAction[] =>
    canWrite
      ? [
          { label: "Edit", icon: Pencil, onSelect: () => setSearch({ edit: m._id, create: undefined }) },
          m.isActive
            ? {
                label: "Deactivate",
                icon: PowerOff,
                onSelect: () => void toggleActive(m),
                destructive: true,
                separated: true,
              }
            : { label: "Reactivate", icon: Power, onSelect: () => void toggleActive(m), separated: true },
        ]
      : []

  const stockCell = (value?: string) =>
    value === undefined ? <span className="text-muted-foreground">—</span> : formatTons(value)

  const columns: AppColumnDef<Row>[] = helper.columns([
    helper.accessor("name", {
      header: "Name",
      cell: (info) => (
        <Link
          to="/materials/$materialId"
          params={{ materialId: info.row.original._id }}
          className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    helper.accessor((m) => m.position?.currentStockTons, {
      id: "inYard",
      header: "In yard (t)",
      cell: (info) => stockCell(info.getValue()),
      meta: { align: "end", label: "In yard" },
    }),
    helper.accessor((m) => m.position?.remainingPOQuantityTons, {
      id: "openOrders",
      header: "Open orders (t)",
      cell: (info) => stockCell(info.getValue()),
      meta: { align: "end", label: "Open orders" },
    }),
    helper.accessor((m) => m.position?.purchaseRequiredTons, {
      id: "buyNeeded",
      header: "Buy needed (t)",
      cell: (info) => <BuyNeeded value={info.getValue()} />,
      meta: { align: "end", label: "Buy needed" },
    }),
    helper.accessor("openingStockTons", {
      header: "Opening stock (t)",
      cell: (info) => formatTons(info.getValue()),
      meta: { align: "end", label: "Opening stock" },
    }),
    helper.accessor("isActive", {
      header: "Status",
      cell: (info) => <StatusBadge status={info.getValue() ? "ACTIVE" : "INACTIVE"} />,
      meta: { label: "Status" },
    }),
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => <RowActions label={info.row.original.name} actions={actionsFor(info.row.original)} />,
      meta: { headerClassName: "w-12", className: "w-12 text-right" },
    }),
  ])

  const total = query.data?.meta.total

  return (
    <>
      <PageHeader
        title="Materials"
        description="Scrap grades you buy and sell, with stock in the yard today."
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={() => setSearch({ create: true, edit: undefined })}>
              <Plus /> New material
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "Material name",
        }}
        filters={[
          {
            id: "status",
            label: "Status",
            allLabel: "Active and inactive",
            value: search.status,
            options: STATUS_OPTIONS,
            onChange: (v) => setSearch({ status: v as MaterialsSearch["status"], ...resetPage }),
          },
        ]}
        onClearAll={() => setSearch({ q: undefined, status: undefined, ...resetPage })}
      />

      <DataTable
        tableId="materials"
        label="Materials"
        columns={columns}
        data={rows}
        getRowId={(m) => m._id}
        total={total}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(m) => navigate({ to: "/materials/$materialId", params: { materialId: m._id } })}
        highlightRowId={highlightId}
        summary={
          total !== undefined ? `${formatCount(total)} ${total === 1 ? "material" : "materials"}` : null
        }
        renderMobileCard={(m) => (
          <RecordCard
            title={
              <Link to="/materials/$materialId" params={{ materialId: m._id }} className="hover:underline">
                {m.name}
              </Link>
            }
            badge={m.isActive ? null : <StatusBadge status="INACTIVE" />}
            actions={<RowActions label={m.name} actions={actionsFor(m)} />}
            onOpen={() => navigate({ to: "/materials/$materialId", params: { materialId: m._id } })}
          >
            <KeyValueList
              className="grid-cols-3 sm:grid-cols-3"
              items={[
                { label: "In yard (t)", value: stockCell(m.position?.currentStockTons), numeric: true },
                {
                  label: "Open orders (t)",
                  value: stockCell(m.position?.remainingPOQuantityTons),
                  numeric: true,
                },
                {
                  label: "Buy needed (t)",
                  value: <BuyNeeded value={m.position?.purchaseRequiredTons} />,
                  numeric: true,
                },
              ]}
            />
          </RecordCard>
        )}
        empty={
          filtered ? (
            <EmptyState
              kind="no-results"
              title="No materials match"
              description="Try another name, or clear the filters."
              action={
                <Button
                  variant="outline"
                  onClick={() => setSearch({ q: undefined, status: undefined, ...resetPage })}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Layers}
              title="No materials yet"
              description="Add the scrap grades you trade, like HMS 1, MS turnings or Brass honey."
              action={
                canWrite ? (
                  <Button onClick={() => setSearch({ create: true })}>
                    <Plus /> Add your first material
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      {canWrite ? (
        <MaterialSheet
          open={Boolean(search.create || search.edit)}
          materialId={search.edit}
          onClose={() => setSearch({ create: undefined, edit: undefined })}
          onSaved={(material) => {
            setSearch({ create: undefined, edit: undefined })
            highlight(material._id)
          }}
        />
      ) : null}
    </>
  )
}
