import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { DASHBOARD_REFETCH } from "@/lib/timing"
import type { CompanySummary, SourceStockRow, Trend, TrendBucket } from "@/types/api"

export type SourceStockParams = { asOf?: string; sourceCompanyId?: string; materialId?: string }
export type TrendParams = {
  from: string
  to: string
  materialId?: string
  companyId?: string
  bucket?: TrendBucket
}
export type CompanyReportParams = { from?: string; to?: string; materialId?: string }

export const reportKeys = {
  all: ["reports"] as const,
  sourceStock: (params: SourceStockParams) => [...reportKeys.all, "source-stock", params] as const,
  trend: (params: TrendParams) => [...reportKeys.all, "trend", params] as const,
  company: (id: string, params: CompanyReportParams) => [...reportKeys.all, "company", id, params] as const,
}

/** Tons bought from each supplier, minus what deliveries drew from that supplier. */
export const sourceStockQuery = (params: SourceStockParams) =>
  queryOptions<SourceStockRow[], Error, SourceStockRow[], ReturnType<typeof reportKeys.sourceStock>>({
    queryKey: reportKeys.sourceStock(params),
    queryFn: ({ signal }) =>
      api.get<SourceStockRow[]>("/reports/source-stock", params, signal).then((r) => r.data),
    placeholderData: keepPreviousData,
  })

/** Bought vs delivered per day / week / month (chosen by the server from the range). */
export const trendQuery = (params: TrendParams) =>
  queryOptions<Trend, Error, Trend, ReturnType<typeof reportKeys.trend>>({
    queryKey: reportKeys.trend(params),
    queryFn: ({ signal }) => api.get<Trend>("/reports/trend", params, signal).then((r) => r.data),
    refetchInterval: DASHBOARD_REFETCH,
    placeholderData: keepPreviousData,
  })

/** One company's purchases, deliveries, open orders and supplier stock for a period. */
export const companyReportQuery = (id: string, params: CompanyReportParams) =>
  queryOptions<CompanySummary, Error, CompanySummary, ReturnType<typeof reportKeys.company>>({
    queryKey: reportKeys.company(id, params),
    queryFn: ({ signal }) =>
      api.get<CompanySummary>(`/reports/companies/${id}`, params, signal).then((r) => r.data),
    placeholderData: keepPreviousData,
  })
