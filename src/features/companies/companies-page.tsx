import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Building2, Pencil, Plus, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/common/page-header"
import { FilterBar } from "@/components/common/filter-bar"
import { DataTable, type AppColumnDef } from "@/components/common/data-table/data-table"
import { createAppColumnHelper } from "@/components/common/data-table/table-features"
import { EmptyState } from "@/components/common/empty-state"
import { StatusBadge } from "@/components/common/status-badge"
import { RowActions, type RowAction } from "@/components/common/row-actions"
import { RecordCard } from "@/components/common/record-card"
import { useConfirm } from "@/components/common/confirm-dialog"
import { companiesQuery, useSaveCompany } from "./api"
import { COMPANY_TYPES, COMPANY_TYPE_OPTIONS } from "./company-types"
import { CompanySheet } from "./company-sheet"
import { useSession } from "@/features/auth/session"
import { useHighlight } from "@/hooks/use-highlight"
import { can } from "@/lib/permissions"
import { formatCount, DASH } from "@/lib/format"
import { DEFAULT_PAGE_SIZE, resetPage } from "@/lib/list-search"
import type { CompaniesSearch } from "./search"
import { notify } from "@/lib/notify"
import type { Company } from "@/types/api"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const helper = createAppColumnHelper<Company>()

function TypeBadge({ type }: { type: Company["type"] }) {
  const t = COMPANY_TYPES[type]
  return (
    <Badge variant="outline" className="h-[22px] rounded-md font-normal">
      <t.icon aria-hidden="true" /> {t.label}
    </Badge>
  )
}

export function CompaniesPage({ search }: { search: CompaniesSearch }) {
  const navigate = useNavigate({ from: "/companies/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const confirm = useConfirm()
  const save = useSaveCompany()
  const [highlightId, highlight] = useHighlight()

  const page = search.page ?? 1
  const limit = search.limit ?? DEFAULT_PAGE_SIZE
  const params = {
    page,
    limit,
    search: search.q,
    type: search.type,
    isActive: search.status === undefined ? undefined : search.status === "active",
  }
  const query = useQuery(companiesQuery(params))
  const filtered = Boolean(search.q || search.type || search.status)

  const setSearch = (patch: Partial<CompaniesSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace })

  const openEdit = (id: string) => setSearch({ edit: id, create: undefined })

  const toggleActive = async (company: Company) => {
    if (!company.isActive) {
      try {
        await save.mutateAsync({ id: company._id, input: { isActive: true } })
        notify.success("Company reactivated", { description: company.name })
        highlight(company._id)
      } catch (error) {
        notify.error("Couldn't reactivate the company", { description: (error as Error).message })
      }
      return
    }
    const ok = await confirm({
      title: `Deactivate ${company.name}?`,
      description:
        "It will no longer appear when you record purchases, orders or deliveries. Past records stay unchanged. You can reactivate it later.",
      cancelLabel: "Keep active",
      confirmLabel: "Deactivate",
      destructive: true,
      onConfirm: () => save.mutateAsync({ id: company._id, input: { isActive: false } }),
    })
    if (ok) notify.success("Company deactivated", { description: company.name })
  }

  const actionsFor = (company: Company): RowAction[] =>
    canWrite
      ? [
          { label: "Edit", icon: Pencil, onSelect: () => openEdit(company._id) },
          company.isActive
            ? {
                label: "Deactivate",
                icon: PowerOff,
                onSelect: () => void toggleActive(company),
                destructive: true,
                separated: true,
              }
            : {
                label: "Reactivate",
                icon: Power,
                onSelect: () => void toggleActive(company),
                separated: true,
              },
        ]
      : []

  const columns: AppColumnDef<Company>[] = helper.columns([
    helper.accessor("name", {
      header: "Name",
      cell: (info) => (
        <Link
          to="/companies/$companyId"
          params={{ companyId: info.row.original._id }}
          className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {info.getValue()}
        </Link>
      ),
      meta: { className: "max-w-72 truncate" },
    }),
    helper.accessor("type", {
      header: "Type",
      cell: (info) => <TypeBadge type={info.getValue()} />,
      meta: { label: "Type" },
    }),
    helper.accessor("gstNumber", {
      header: "GSTIN",
      cell: (info) =>
        info.getValue() ? (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ) : (
          <span className="text-muted-foreground">{DASH}</span>
        ),
      meta: { label: "GSTIN" },
    }),
    helper.accessor((c) => c.contact?.person, {
      id: "person",
      header: "Contact",
      cell: (info) => info.getValue() ?? <span className="text-muted-foreground">{DASH}</span>,
      meta: { label: "Contact person" },
    }),
    helper.accessor((c) => c.contact?.phone, {
      id: "phone",
      header: "Phone",
      cell: (info) =>
        info.getValue() ? (
          <span className="tabular-nums">{info.getValue()}</span>
        ) : (
          <span className="text-muted-foreground">{DASH}</span>
        ),
      meta: { label: "Phone" },
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
        title="Companies"
        description="Suppliers you buy scrap from and buyers you sell to."
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={() => setSearch({ create: true, edit: undefined })}>
              <Plus /> New company
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={{
          value: search.q,
          onChange: (q) => setSearch({ q, ...resetPage }, true),
          placeholder: "Name or GST number",
        }}
        filters={[
          {
            id: "type",
            label: "Type",
            allLabel: "All types",
            value: search.type,
            options: COMPANY_TYPE_OPTIONS,
            onChange: (v) => setSearch({ type: v as CompaniesSearch["type"], ...resetPage }),
          },
          {
            id: "status",
            label: "Status",
            allLabel: "Active and inactive",
            value: search.status,
            options: STATUS_OPTIONS,
            onChange: (v) => setSearch({ status: v as CompaniesSearch["status"], ...resetPage }),
          },
        ]}
        onClearAll={() => setSearch({ q: undefined, type: undefined, status: undefined, ...resetPage })}
      />

      <DataTable
        tableId="companies"
        label="Companies"
        columns={columns}
        data={query.data?.items}
        getRowId={(c) => c._id}
        total={total}
        page={page}
        pageSize={limit}
        onPageChange={(p) => setSearch({ page: p })}
        onPageSizeChange={(l) => setSearch({ limit: l, ...resetPage })}
        isPending={query.isPending}
        isRefreshing={query.isPlaceholderData && query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(c) => navigate({ to: "/companies/$companyId", params: { companyId: c._id } })}
        highlightRowId={highlightId}
        summary={
          total !== undefined ? `${formatCount(total)} ${total === 1 ? "company" : "companies"}` : null
        }
        renderMobileCard={(c) => (
          <RecordCard
            title={
              <Link to="/companies/$companyId" params={{ companyId: c._id }} className="hover:underline">
                {c.name}
              </Link>
            }
            badge={c.isActive ? null : <StatusBadge status="INACTIVE" />}
            actions={<RowActions label={c.name} actions={actionsFor(c)} />}
            onOpen={() => navigate({ to: "/companies/$companyId", params: { companyId: c._id } })}
            footer={[c.contact?.phone, c.gstNumber].filter(Boolean).join(" · ") || undefined}
          >
            <div>
              <TypeBadge type={c.type} />
            </div>
          </RecordCard>
        )}
        empty={
          filtered ? (
            <EmptyState
              kind="no-results"
              title="No companies match"
              description="Try another name, or clear the filters."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setSearch({ q: undefined, type: undefined, status: undefined, ...resetPage })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add the suppliers you buy scrap from and the buyers who send you orders."
              action={
                canWrite ? (
                  <Button onClick={() => setSearch({ create: true })}>
                    <Plus /> Add your first company
                  </Button>
                ) : undefined
              }
            />
          )
        }
      />

      {canWrite ? (
        <CompanySheet
          open={Boolean(search.create || search.edit)}
          companyId={search.edit}
          onClose={() => setSearch({ create: undefined, edit: undefined })}
          onSaved={(company) => {
            setSearch({ create: undefined, edit: undefined })
            highlight(company._id)
          }}
        />
      ) : null}
    </>
  )
}
