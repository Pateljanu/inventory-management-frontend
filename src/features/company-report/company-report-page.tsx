import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery, type UseQueryResult } from "@tanstack/react-query"
import { ArrowDownToLine, ClipboardList, FileBarChart, Truck, Warehouse } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import { StatusBadge } from "@/components/common/status-badge"
import { DateRangePicker } from "@/components/common/date-range-picker"
import { EntityFilter } from "@/components/common/entity-filter"
import { TrendChart } from "@/features/dashboard/trend-chart"
import { companyReportQuery, trendQuery } from "@/features/reports/api"
import { COMPANY_TYPES, isSupplier } from "@/features/companies/company-types"
import { businessToday } from "@/lib/dates"
import { describeRange, resolvePreset } from "@/lib/fy"
import { isPositive, plus, toBig } from "@/lib/decimal"
import {
  DASH,
  formatCount,
  formatDate,
  formatMoney,
  formatRate,
  formatTons,
  formatTonsCompact,
} from "@/lib/format"
import type { CompanyReportSearch } from "./search"
import type { CompanySummary, CompanyType, DashboardMaterialRow, Trend } from "@/types/api"

const isBuyer = (type: CompanyType) => type === "SALE" || type === "BOTH"

/**
 * Everything done with one company in a period: what was bought from them, delivered to them,
 * their open orders and the stock still held under their name. A company that is both supplier
 * and buyer shows both sides.
 */
export function CompanyReportPage({ search }: { search: CompanyReportSearch }) {
  const navigate = useNavigate({ from: "/company-report/" })
  const today = businessToday()
  const valid = search.from && search.to && search.from <= search.to
  const range = valid
    ? { from: search.from!, to: search.to! > today ? today : search.to! }
    : resolvePreset("this-fy", today, { clampToToday: true })

  const params = { ...range, materialId: search.material }
  const report = useQuery({
    ...companyReportQuery(search.company ?? "", params),
    enabled: Boolean(search.company),
  })
  const trend = useQuery({
    ...trendQuery({ ...range, companyId: search.company, materialId: search.material }),
    enabled: Boolean(search.company),
  })

  const setSearch = (patch: Partial<CompanyReportSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) })

  const data = report.data

  return (
    <>
      <PageHeader
        title={
          data && search.company ? (
            <span className="flex flex-wrap items-center gap-2">
              {data.company.name}
              <TypeBadge type={data.company.type} />
              {!data.company.isActive ? <StatusBadge status="INACTIVE" /> : null}
            </span>
          ) : (
            "Company report"
          )
        }
        description={
          search.company
            ? `${describeRange(range.from, range.to)}. Stock and open orders are as on the last day.`
            : "Purchases, deliveries, open orders and stock for one company."
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <EntityFilter
          kind="company"
          value={search.company}
          allLabel="Choose a company"
          onChange={(id) => setSearch({ company: id })}
        />
        <DateRangePicker
          from={range.from}
          to={range.to}
          clearable={false}
          onChange={(r) => r && setSearch({ from: r.from, to: r.to })}
        />
        <EntityFilter
          kind="material"
          value={search.material}
          allLabel="All materials"
          onChange={(id) => setSearch({ material: id })}
        />
        {data ? (
          <Link
            to="/companies/$companyId"
            params={{ companyId: data.company._id }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Company details
          </Link>
        ) : null}
      </div>

      {!search.company ? (
        <EmptyState
          icon={FileBarChart}
          title="Choose a company"
          description="Pick a supplier or buyer above to see everything done with them in the period."
        />
      ) : report.error && !data ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Report data={data} range={range} materialId={search.material} trend={trend} />
      )}
    </>
  )
}

function TypeBadge({ type }: { type: CompanyType }) {
  const t = COMPANY_TYPES[type]
  return (
    <Badge variant="outline" className="h-[22px] rounded-md font-normal">
      <t.icon aria-hidden="true" /> {t.label}
    </Badge>
  )
}

function Report({
  data,
  range,
  materialId,
  trend,
}: {
  data: CompanySummary
  range: { from: string; to: string }
  materialId?: string
  trend: UseQueryResult<Trend>
}) {
  const supplier = isSupplier(data.company.type)
  const buyer = isBuyer(data.company.type)
  const id = data.company._id
  const available = data.sourceStock.reduce((sum, r) => plus(sum, r.availableTons), toBig(0)).toFixed(3)
  const rows = data.materials.filter(
    (m) => isPositive(m.purchasedTons) || isPositive(m.soldTons) || isPositive(m.remainingPOQuantityTons)
  )

  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {supplier ? (
          <StatCard
            label="Bought from them"
            icon={<ArrowDownToLine className="size-4" />}
            value={formatTonsCompact(data.purchases.quantityTons)}
            exactValue={formatTons(data.purchases.quantityTons, { unit: true })}
            footnote={
              isPositive(data.purchases.quantityTons)
                ? `${formatMoney(data.purchases.value)} · avg ${formatRate(data.purchases.averageBuyingRate)}`
                : "No purchases in this period"
            }
            href="/purchases"
            search={{ supplier: id, material: materialId, ...range }}
          />
        ) : null}
        {buyer ? (
          <StatCard
            label="Delivered to them"
            icon={<Truck className="size-4" />}
            value={formatTonsCompact(data.sales.quantityTons)}
            exactValue={formatTons(data.sales.quantityTons, { unit: true })}
            footnote={
              isPositive(data.sales.quantityTons)
                ? `${formatMoney(data.sales.value)} · avg ${formatRate(data.sales.averageSellingRate)}`
                : "No deliveries in this period"
            }
            href="/deliveries"
            search={{ buyer: id, material: materialId, ...range }}
          />
        ) : null}
        {buyer ? (
          <StatCard
            label="Open orders"
            icon={<ClipboardList className="size-4" />}
            value={formatCount(data.po.openPOCount)}
            footnote={`${formatTons(data.po.remainingQuantityTons, { unit: true })} left to deliver`}
            href="/sales-orders"
            search={{ buyer: id, material: materialId }}
          />
        ) : null}
        {supplier ? (
          <StatCard
            label="Stock with them"
            icon={<Warehouse className="size-4" />}
            value={formatTonsCompact(available)}
            exactValue={formatTons(available, { unit: true })}
            footnote="Bought from them and not yet delivered"
            href="/supplier-stock"
            search={{ supplier: id, material: materialId }}
          />
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>By material</CardTitle>
          <CardDescription>
            {supplier && buyer
              ? "What was bought from and delivered to this company, per material."
              : supplier
                ? "What was bought from this supplier, per material."
                : "What was delivered to this buyer, and what is still on order, per material."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                kind="no-results"
                title="Nothing in this period"
                description="Try a longer period, like This FY or Last FY."
              />
            </div>
          ) : (
            <MaterialTable rows={rows} supplier={supplier} buyer={buyer} totals={data} />
          )}
        </CardContent>
      </Card>

      {supplier && data.sourceStock.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Stock with this supplier</CardTitle>
            <CardDescription>
              On {formatDate(range.to)}: bought, used by deliveries, and left.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Material</TableHead>
                  <TableHead className="text-right">Bought (t)</TableHead>
                  <TableHead className="text-right">Used for deliveries (t)</TableHead>
                  <TableHead className="pr-4 text-right">Available (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sourceStock.map((r) => (
                  <TableRow key={r.materialId}>
                    <TableCell className="pl-4">{r.materialName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTons(r.purchasedTons)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTons(r.usedForSalesTons)}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-semibold tabular-nums">
                      {formatTons(r.availableTons)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <TrendChart
        trend={trend.data}
        loading={trend.isPending}
        error={trend.error}
        onRetry={() => trend.refetch()}
      />
    </>
  )
}

function MaterialTable({
  rows,
  supplier,
  buyer,
  totals,
}: {
  rows: DashboardMaterialRow[]
  supplier: boolean
  buyer: boolean
  totals: CompanySummary
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Material</TableHead>
            {supplier ? (
              <>
                <TableHead className="text-right">Bought (t)</TableHead>
                <TableHead className="text-right">Avg buy rate (₹/t)</TableHead>
                <TableHead className="text-right">Bought (₹)</TableHead>
              </>
            ) : null}
            {buyer ? (
              <>
                <TableHead className="text-right">Delivered (t)</TableHead>
                <TableHead className="text-right">Avg sell rate (₹/t)</TableHead>
                <TableHead className="text-right">Delivered (₹)</TableHead>
                <TableHead className="pr-4 text-right">Left on orders (t)</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.materialId}>
              <TableCell className="pl-4 font-medium">{m.materialName}</TableCell>
              {supplier ? (
                <>
                  <TableCell className="text-right tabular-nums">{formatTons(m.purchasedTons)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isPositive(m.purchasedTons) ? formatMoney(m.averageBuyingRate, { symbol: false }) : DASH}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(m.purchaseValue, { symbol: false })}
                  </TableCell>
                </>
              ) : null}
              {buyer ? (
                <>
                  <TableCell className="text-right tabular-nums">{formatTons(m.soldTons)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isPositive(m.soldTons) ? formatMoney(m.averageSellingRate, { symbol: false }) : DASH}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(m.salesValue, { symbol: false })}
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatTons(m.remainingPOQuantityTons)}
                  </TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-4 font-semibold">Total</TableCell>
            {supplier ? (
              <>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatTons(totals.purchases.quantityTons)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isPositive(totals.purchases.quantityTons)
                    ? formatMoney(totals.purchases.averageBuyingRate, { symbol: false })
                    : DASH}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(totals.purchases.value, { symbol: false })}
                </TableCell>
              </>
            ) : null}
            {buyer ? (
              <>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatTons(totals.sales.quantityTons)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {isPositive(totals.sales.quantityTons)
                    ? formatMoney(totals.sales.averageSellingRate, { symbol: false })
                    : DASH}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(totals.sales.value, { symbol: false })}
                </TableCell>
                <TableCell className="pr-4 text-right font-semibold tabular-nums">
                  {formatTons(totals.po.remainingQuantityTons)}
                </TableCell>
              </>
            ) : null}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
