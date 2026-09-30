import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ClipboardList, PackageOpen, TriangleAlert, Truck } from "lucide-react"
import { PageHeader } from "@/components/common/page-header"
import { StatCard } from "@/components/common/stat-card"
import { ErrorState } from "@/components/common/error-state"
import { dashboardQuery } from "./api"
import { dashboardPeriod } from "./period"
import { moneyDelta, stockDelta } from "./kpi"
import type { DashboardSearch } from "./search"
import { PeriodControl } from "./period-control"
import { NeedsAttention } from "./needs-attention"
import { StockVsOrders } from "./stock-vs-orders"
import { TrendChart } from "./trend-chart"
import { RecentActivity } from "./recent-activity"
import { StockBySupplier, Buyers } from "./company-panels"
import { buyerActivity, supplierStock } from "./company-wise"
import { sourceStockQuery, trendQuery } from "@/features/reports/api"
import { salesOrdersQuery } from "@/features/sales-orders/api"
import { deliveriesQuery } from "@/features/deliveries/api"
import { purchasesQuery } from "@/features/purchases/api"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"
import { businessToday } from "@/lib/dates"
import { comparisonRange } from "@/lib/fy"
import { cmp, isPositive, plus, toBig } from "@/lib/decimal"
import {
  formatCount,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatTons,
  formatTonsCompact,
} from "@/lib/format"

const OPEN = ["PENDING", "PARTIALLY_SUPPLIED"] as const

function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now)
  )
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
}

/**
 * The one operational screen: what to buy and what can be delivered. Every number links to the
 * records behind it, and money is compared like for like with an earlier period.
 */
export function DashboardPage({ search }: { search: DashboardSearch }) {
  const navigate = useNavigate({ from: "/" })
  const { user } = useSession()
  const canWrite = can(user, "write")
  const today = businessToday()
  const period = dashboardPeriod(search, today)
  const comparison = comparisonRange(period)
  const range = { from: period.from, to: period.to }

  const main = useQuery(dashboardQuery(range))
  const previous = useQuery(dashboardQuery(comparison.range))
  const trend = useQuery(trendQuery(range))
  const openOrders = useQuery(salesOrdersQuery({ page: 1, limit: 100, status: [...OPEN] }))
  const deliveryCount = useQuery(deliveriesQuery({ ...range, page: 1, limit: 1 }))
  const recentPurchases = useQuery(purchasesQuery({ page: 1, limit: 6 }))
  const recentDeliveries = useQuery(deliveriesQuery({ page: 1, limit: 6 }))
  const pools = useQuery(sourceStockQuery({ asOf: period.to }))

  const data = main.data
  const materials = data?.materials ?? []
  const stock = materials.reduce((sum, m) => plus(sum, m.currentStockTons), toBig(0)).toFixed(3)
  const short = materials
    .filter((m) => isPositive(m.purchaseRequiredTons))
    .sort((a, b) => cmp(b.purchaseRequiredTons, a.purchaseRequiredTons))
  const buyNeeded = short.reduce((sum, m) => plus(sum, m.purchaseRequiredTons), toBig(0)).toFixed(3)

  const orders = openOrders.data?.items
  const orderTotal = openOrders.data?.meta.total
  const pending = orders?.filter((o) => o.displayStatus === "PENDING").length ?? 0
  const deliveries = deliveryCount.data?.meta.total

  // Open orders are "now": only shown per buyer for a period ending today, and only when all loaded.
  const allOpenOrders =
    period.endsToday && orders && orderTotal !== undefined && orderTotal <= orders.length ? orders : undefined
  const suppliers = supplierStock(pools.data ?? [], data?.companies.suppliers ?? [])
  const buyers = buyerActivity(data?.companies.buyers ?? [], allOpenOrders)

  const queries = [main, previous, trend, openOrders, deliveryCount, recentPurchases, recentDeliveries, pools]
  const refreshing = queries.some((q) => q.isFetching)
  const refresh = () => queries.forEach((q) => void q.refetch())
  const firstName = user?.name?.split(" ")[0]

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <>
            {greeting()}
            {firstName ? `, ${firstName}` : ""}. Here&apos;s{" "}
            {period.preset ? period.words : "your chosen period"}
            {period.endsToday && period.preset !== "today" ? " so far" : ""}.
          </>
        }
        secondaryActions={
          <PeriodControl
            period={period}
            comparison={comparison.range}
            onChange={(r) => navigate({ search: { from: r.from, to: r.to } })}
            updatedAt={main.dataUpdatedAt}
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
      />

      {main.error && !data ? (
        <ErrorState error={main.error} onRetry={() => main.refetch()} retrying={main.isRefetching} />
      ) : (
        <>
          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
            <StatCard
              label={period.endsToday ? "Stock in yard" : `Stock on ${formatDate(period.to)}`}
              icon={<PackageOpen className="size-4" />}
              loading={main.isPending}
              value={formatTonsCompact(stock)}
              exactValue={formatTons(stock, { unit: true })}
              delta={
                data
                  ? stockDelta(data.purchases.quantityTons, data.sales.quantityTons, period.from)
                  : undefined
              }
              footnote={`${formatCount(materials.length)} materials · by supplier →`}
              href="/supplier-stock"
            />
            <StatCard
              label="Buy needed"
              icon={<TriangleAlert className="size-4" />}
              tone={short.length ? "warning" : "default"}
              loading={main.isPending}
              value={formatTonsCompact(buyNeeded)}
              exactValue={formatTons(buyNeeded, { unit: true })}
              delta={
                short.length
                  ? {
                      trend: "up",
                      tone: "bad",
                      text: `${short.length} ${short.length === 1 ? "material is" : "materials are"} short of open orders`,
                    }
                  : undefined
              }
              footnote={
                short.length ? (
                  <span className="line-clamp-2">
                    {short
                      .slice(0, 3)
                      .map((m) => `${m.materialName} ${formatTons(m.purchaseRequiredTons, { unit: true })}`)
                      .join(" · ")}
                  </span>
                ) : (
                  "Stock covers all open orders"
                )
              }
              href="/materials"
            />
            <StatCard
              label="Open sales orders"
              icon={<ClipboardList className="size-4" />}
              loading={main.isPending}
              value={formatCount(data?.po.openPOCount)}
              footnote={
                <>
                  {formatTons(data?.po.remainingQuantityTons, { unit: true })} left to deliver
                  {period.endsToday && orders && orderTotal !== undefined && orderTotal <= orders.length ? (
                    <span className="block">
                      {formatCount(pending)} pending · {formatCount(orderTotal - pending)} partly delivered
                    </span>
                  ) : null}
                </>
              }
              href="/sales-orders"
            />
            <StatCard
              label={`Delivered ${period.words}`}
              icon={<Truck className="size-4" />}
              loading={main.isPending}
              value={formatMoneyCompact(data?.sales.value)}
              exactValue={formatMoney(data?.sales.value)}
              delta={
                data && previous.data
                  ? moneyDelta(data.sales.value, previous.data.sales.value, comparison.label)
                  : undefined
              }
              footnote={`${formatTons(data?.sales.quantityTons, { unit: true })}${
                deliveries !== undefined
                  ? ` in ${formatCount(deliveries)} ${deliveries === 1 ? "delivery" : "deliveries"}`
                  : ""
              }`}
              href="/deliveries"
              search={range}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <NeedsAttention
              className="xl:col-span-2"
              materials={materials}
              openOrders={orders}
              openOrderTotal={orderTotal}
              loading={main.isPending || openOrders.isPending}
              canWrite={canWrite}
              today={today}
            />
            <StockVsOrders materials={materials} loading={main.isPending} asOfToday={period.endsToday} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <StockBySupplier
              rows={suppliers}
              yardTons={stock}
              loading={main.isPending || pools.isPending}
              asOfToday={period.endsToday}
              range={range}
            />
            <Buyers rows={buyers} loading={main.isPending || openOrders.isPending} range={range} />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <TrendChart
              className="xl:col-span-7"
              trend={trend.data}
              loading={trend.isPending}
              error={trend.error}
              onRetry={() => trend.refetch()}
            />
            <RecentActivity
              className="xl:col-span-5"
              purchases={recentPurchases.data?.items}
              deliveries={recentDeliveries.data?.items}
              loading={recentPurchases.isPending || recentDeliveries.isPending}
            />
          </div>
        </>
      )}
    </>
  )
}
