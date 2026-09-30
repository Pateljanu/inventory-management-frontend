import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { DASHBOARD_REFETCH } from "@/lib/timing"
import type { Dashboard } from "@/types/api"

export type DashboardParams = { from?: string; to?: string; materialId?: string; companyId?: string }

export const dashboardKeys = {
  all: ["dashboard"] as const,
  period: (params: DashboardParams) => [...dashboardKeys.all, params] as const,
}

export const dashboardQuery = (params: DashboardParams) =>
  queryOptions<Dashboard, Error, Dashboard, ReturnType<typeof dashboardKeys.period>>({
    queryKey: dashboardKeys.period(params),
    queryFn: ({ signal }) => api.get<Dashboard>("/reports/dashboard", params, signal).then((r) => r.data),
    refetchInterval: DASHBOARD_REFETCH,
    // Keep showing the previous period's numbers while a new period loads.
    placeholderData: keepPreviousData,
  })
