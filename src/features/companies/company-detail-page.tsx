import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { FileBarChart, Pencil, Power, PowerOff, Warehouse } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/common/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { KeyValueList } from "@/components/common/key-value-list"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { useConfirm } from "@/components/common/confirm-dialog"
import { companyQuery, useSaveCompany } from "./api"
import { COMPANY_TYPES, isSupplier } from "./company-types"
import { CompanySheet } from "./company-sheet"
import { sourceStockQuery } from "@/features/reports/api"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"
import { plus, toBig, isNegative } from "@/lib/decimal"
import { formatDateTime, formatTons } from "@/lib/format"
import { notify } from "@/lib/notify"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { Company, SourceStockRow } from "@/types/api"

export function CompanyDetailPage({ companyId, editing }: { companyId: string; editing: boolean }) {
  const navigate = useNavigate({ from: "/companies/$companyId" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const confirm = useConfirm()
  const save = useSaveCompany()
  const { data: company, error, refetch } = useQuery(companyQuery(companyId))

  if (!company) return error ? <ErrorState error={error} onRetry={() => refetch()} /> : null

  const type = COMPANY_TYPES[company.type]
  const setEditing = (on: boolean) => navigate({ search: { edit: on || undefined } })

  const toggleActive = async () => {
    if (!company.isActive) {
      try {
        await save.mutateAsync({ id: company._id, input: { isActive: true } })
        notify.success("Company reactivated", { description: company.name })
      } catch (err) {
        notify.error("Couldn't reactivate the company", { description: errorMessage(err) })
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

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {company.name}
            <Badge variant="outline" className="h-[22px] rounded-md font-normal">
              <type.icon aria-hidden="true" /> {type.label}
            </Badge>
            {!company.isActive ? <StatusBadge status="INACTIVE" /> : null}
          </span>
        }
        description={type.description}
        secondaryActions={
          <>
            <Button
              variant="outline"
              className="h-10 md:h-9"
              render={<Link to="/company-report" search={{ company: company._id }} />}
            >
              <FileBarChart /> View report
            </Button>
            {canWrite ? (
              <Button variant="outline" className="h-10 md:h-9" onClick={toggleActive}>
                {company.isActive ? <PowerOff /> : <Power />}
                {company.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            ) : null}
          </>
        }
        primaryAction={
          canWrite ? (
            <Button className="h-10 md:h-9" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <CompanyDetails company={company} />
          </CardContent>
        </Card>

        {isSupplier(company.type) ? <SupplierStockCard company={company} className="lg:col-span-2" /> : null}
      </div>

      {canWrite ? (
        <CompanySheet
          open={editing}
          companyId={company._id}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}

function CompanyDetails({ company }: { company: Company }) {
  const phone = company.contact?.phone
  const email = company.contact?.email
  return (
    <KeyValueList
      items={[
        {
          label: "GST number",
          value: company.gstNumber && <span className="font-mono">{company.gstNumber}</span>,
        },
        { label: "Contact person", value: company.contact?.person },
        {
          label: "Phone",
          value: phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="text-primary tabular-nums hover:underline"
            >
              {phone}
            </a>
          ),
        },
        {
          label: "Email",
          value: email && (
            <a href={`mailto:${email}`} className="text-primary hover:underline">
              {email}
            </a>
          ),
        },
        {
          label: "Address",
          value: company.address && <span className="whitespace-pre-line">{company.address}</span>,
        },
        { label: "Added on", value: formatDateTime(company.createdAt) },
      ]}
    />
  )
}

/** Answers "what can I still deliver from this supplier?" per material. */
function SupplierStockCard({ company, className }: { company: Company; className?: string }) {
  const { data, error, isPending, refetch } = useQuery(sourceStockQuery({ sourceCompanyId: company._id }))
  const rows = data ?? []
  const totals = rows.reduce(
    (acc, r: SourceStockRow) => ({
      purchased: plus(acc.purchased, r.purchasedTons),
      used: plus(acc.used, r.usedForSalesTons),
      available: plus(acc.available, r.availableTons),
    }),
    { purchased: toBig(0), used: toBig(0), available: toBig(0) }
  )

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Stock with this supplier</CardTitle>
        <CardDescription>
          Tons bought from {company.name}, minus what deliveries have drawn from them. Deliveries can only use
          what is still available here.
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
              title="Nothing bought yet"
              description={`Purchases from ${company.name} will build stock here.`}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Material</TableHead>
                <TableHead className="text-right">Bought (t)</TableHead>
                <TableHead className="text-right">Delivered (t)</TableHead>
                <TableHead className="pr-4 text-right">Available (t)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.materialId}>
                  <TableCell className="pl-4 font-medium">{r.materialName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTons(r.purchasedTons)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTons(r.usedForSalesTons)}</TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 text-right font-medium tabular-nums",
                      isNegative(r.availableTons) && "text-destructive"
                    )}
                  >
                    {formatTons(r.availableTons)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTons(totals.purchased.toFixed(3))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatTons(totals.used.toFixed(3))}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {formatTons(totals.available.toFixed(3))}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
