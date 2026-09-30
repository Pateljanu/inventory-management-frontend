import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ArrowDownToLine, IndianRupee, Percent, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { DateRangePicker } from "@/components/common/date-range-picker"
import { EntityFilter } from "@/components/common/entity-filter"
import { dashboardQuery } from "@/features/dashboard/api"
import { businessToday } from "@/lib/dates"
import { describeRange, resolvePreset } from "@/lib/fy"
import { isPositive } from "@/lib/decimal"
import { DASH, formatMoney, formatPercent, formatRate, formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import { rateSpread, type RateSpread } from "./spread"
import type { RateAnalysisSearch } from "./search"
import type { Dashboard } from "@/types/api"

const signedRate = (s: RateSpread) => `${s.tone === "good" ? "+" : ""}${formatRate(s.amount)}`
const signedPercent = (s: RateSpread) => `${s.percent > 0 ? "+" : ""}${formatPercent(s.percent, 2)}`
const TONE_TEXT = { good: "text-success", bad: "text-destructive", neutral: "text-muted-foreground" }

/**
 * Weighted average buying and selling rates (total value ÷ total tons) for a period, overall
 * or for one material, with the gap between them and the same figures per material.
 */
export function RateAnalysisPage({ search }: { search: RateAnalysisSearch }) {
  const navigate = useNavigate({ from: "/rate-analysis/" })
  const today = businessToday()
  const valid = search.from && search.to && search.from <= search.to
  const range = valid
    ? { from: search.from!, to: search.to! > today ? today : search.to! }
    : resolvePreset("this-fy", today, { clampToToday: true })

  const report = useQuery(dashboardQuery({ ...range, materialId: search.material }))
  const setSearch = (patch: Partial<RateAnalysisSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) })

  const data = report.data

  return (
    <>
      <PageHeader
        title="Rate analysis"
        description={`${describeRange(range.from, range.to)}. Averages are weighted: total value ÷ total tons.`}
      />

      <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {report.error && !data ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} retrying={report.isRefetching} />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Report
          data={data}
          range={range}
          materialId={search.material}
          onPickMaterial={(id) => setSearch({ material: id })}
        />
      )}
    </>
  )
}

function Report({
  data,
  range,
  materialId,
  onPickMaterial,
}: {
  data: Dashboard
  range: { from: string; to: string }
  materialId?: string
  onPickMaterial: (id: string | undefined) => void
}) {
  const { purchases, sales } = data
  const bought = isPositive(purchases.quantityTons)
  const sold = isPositive(sales.quantityTons)
  const spread = rateSpread(
    purchases.quantityTons,
    purchases.averageBuyingRate,
    sales.quantityTons,
    sales.averageSellingRate
  )
  const rows = data.materials.filter((m) => isPositive(m.purchasedTons) || isPositive(m.soldTons))
  const mixed = !materialId && rows.length > 1
  const noSpread = !bought
    ? "No purchases in this period"
    : !sold
      ? "No deliveries in this period"
      : "Needs a buying rate above zero"
  const listSearch = { material: materialId, ...range }

  return (
    <>
      <section aria-label="Average rates" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard
          label="Avg buying rate"
          icon={<ArrowDownToLine className="size-4" />}
          value={bought ? formatRate(purchases.averageBuyingRate) : DASH}
          footnote={
            bought
              ? `${formatTons(purchases.quantityTons, { unit: true })} bought · ${formatMoney(purchases.value)}`
              : "No purchases in this period"
          }
          href="/purchases"
          search={listSearch}
        />
        <StatCard
          label="Avg selling rate"
          icon={<Truck className="size-4" />}
          value={sold ? formatRate(sales.averageSellingRate) : DASH}
          footnote={
            sold
              ? `${formatTons(sales.quantityTons, { unit: true })} delivered · ${formatMoney(sales.value)}`
              : "No deliveries in this period"
          }
          href="/deliveries"
          search={listSearch}
        />
        <StatCard
          label="Rate difference"
          icon={<IndianRupee className="size-4" />}
          value={spread ? <span className={TONE_TEXT[spread.tone]}>{signedRate(spread)}</span> : DASH}
          delta={
            spread
              ? {
                  trend: spread.tone === "good" ? "up" : spread.tone === "bad" ? "down" : "flat",
                  tone: spread.tone,
                  text:
                    spread.tone === "good"
                      ? "Selling above buying"
                      : spread.tone === "bad"
                        ? "Selling below buying"
                        : "No change: selling at buying rate",
                }
              : undefined
          }
          footnote={spread ? "Avg selling − avg buying" : noSpread}
        />
        <StatCard
          label="Difference %"
          icon={<Percent className="size-4" />}
          value={spread ? <span className={TONE_TEXT[spread.tone]}>{signedPercent(spread)}</span> : DASH}
          footnote={spread ? "Of the average buying rate" : noSpread}
        />
      </section>

      {mixed ? (
        <p className="text-sm text-muted-foreground">
          The overall averages mix every material. Pick a material above, or click one below, for a
          like-for-like rate.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>By material</CardTitle>
          <CardDescription>
            Tons, value and weighted average rate bought and delivered, with the gap between the rates.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <div className="px-4">
              <EmptyState
                kind="no-results"
                title="Nothing bought or delivered in this period"
                description="Try a longer period, like This FY or Last FY."
              />
            </div>
          ) : (
            <MaterialTable
              rows={rows}
              totals={data}
              totalSpread={spread}
              materialId={materialId}
              onPickMaterial={onPickMaterial}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}

function SpreadCells({ spread, last }: { spread: RateSpread | null; last?: boolean }) {
  return (
    <>
      <TableCell className={cn("text-right font-medium tabular-nums", spread && TONE_TEXT[spread.tone])}>
        {spread ? signedRate(spread) : DASH}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", last && "pr-4", spread && TONE_TEXT[spread.tone])}>
        {spread ? signedPercent(spread) : DASH}
      </TableCell>
    </>
  )
}

function MaterialTable({
  rows,
  totals,
  totalSpread,
  materialId,
  onPickMaterial,
}: {
  rows: Dashboard["materials"]
  totals: Dashboard
  totalSpread: RateSpread | null
  materialId?: string
  onPickMaterial: (id: string | undefined) => void
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Material</TableHead>
            <TableHead className="text-right">Bought (t)</TableHead>
            <TableHead className="text-right">Bought (₹)</TableHead>
            <TableHead className="text-right">Avg buy (₹/t)</TableHead>
            <TableHead className="text-right">Delivered (t)</TableHead>
            <TableHead className="text-right">Delivered (₹)</TableHead>
            <TableHead className="text-right">Avg sell (₹/t)</TableHead>
            <TableHead className="text-right">Difference (₹/t)</TableHead>
            <TableHead className="pr-4 text-right">Difference %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const spread = rateSpread(m.purchasedTons, m.averageBuyingRate, m.soldTons, m.averageSellingRate)
            return (
              <TableRow key={m.materialId}>
                <TableCell className="pl-4 font-medium">
                  {materialId ? (
                    m.materialName
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 font-medium text-foreground"
                      onClick={() => onPickMaterial(m.materialId)}
                    >
                      {m.materialName}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatTons(m.purchasedTons)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(m.purchaseValue, { symbol: false })}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {isPositive(m.purchasedTons) ? formatMoney(m.averageBuyingRate, { symbol: false }) : DASH}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatTons(m.soldTons)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(m.salesValue, { symbol: false })}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {isPositive(m.soldTons) ? formatMoney(m.averageSellingRate, { symbol: false }) : DASH}
                </TableCell>
                <SpreadCells spread={spread} last />
              </TableRow>
            )
          })}
        </TableBody>
        {rows.length > 1 ? (
          <TableFooter>
            <TableRow>
              <TableCell className="pl-4 font-semibold">All materials</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatTons(totals.purchases.quantityTons)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(totals.purchases.value, { symbol: false })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {isPositive(totals.purchases.quantityTons)
                  ? formatMoney(totals.purchases.averageBuyingRate, { symbol: false })
                  : DASH}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatTons(totals.sales.quantityTons)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(totals.sales.value, { symbol: false })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {isPositive(totals.sales.quantityTons)
                  ? formatMoney(totals.sales.averageSellingRate, { symbol: false })
                  : DASH}
              </TableCell>
              <SpreadCells spread={totalSpread} last />
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  )
}
