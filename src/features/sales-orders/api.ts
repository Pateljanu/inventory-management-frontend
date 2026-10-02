import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Paginated, POLifecycle, PODisplayStatus, Sale, SalesPO, Saved } from "@/types/api"

export type SalesOrderListParams = {
  page?: number
  limit?: number
  search?: string
  from?: string
  to?: string
  companyId?: string
  materialId?: string
  /** One or more derived statuses. */
  status?: PODisplayStatus[]
}

export const salesOrderKeys = {
  all: ["sales-orders"] as const,
  list: (params: SalesOrderListParams) => [...salesOrderKeys.all, "list", params] as const,
  detail: (id: string) => [...salesOrderKeys.all, "detail", id] as const,
  openCount: () => [...salesOrderKeys.all, "open-count"] as const,
  deliveries: (id: string) => [...salesOrderKeys.all, "deliveries", id] as const,
}

export const salesOrdersQuery = ({ status, ...params }: SalesOrderListParams) =>
  queryOptions<Paginated<SalesPO>, Error, Paginated<SalesPO>, ReturnType<typeof salesOrderKeys.list>>({
    queryKey: salesOrderKeys.list({ status, ...params }),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<SalesPO[]>("/sales-pos", { ...params, status }, signal)
      return { items: data, meta: meta! }
    },
    placeholderData: keepPreviousData,
  })

/** Includes delivered/remaining tons and the derived status. */
export const salesOrderQuery = (id: string) =>
  queryOptions({
    queryKey: salesOrderKeys.detail(id),
    queryFn: ({ signal }) => api.get<SalesPO>(`/sales-pos/${id}`, undefined, signal).then((r) => r.data),
  })

/** Open orders (Pending + Partly delivered) for the sidebar badge, without loading any rows. */
export const openOrdersCountQuery = () =>
  queryOptions({
    queryKey: salesOrderKeys.openCount(),
    queryFn: async ({ signal }) => {
      const { meta } = await api.get<SalesPO[]>(
        "/sales-pos",
        { status: ["PENDING", "PARTIALLY_SUPPLIED"], limit: 1 },
        signal
      )
      return meta?.total ?? 0
    },
    staleTime: 60_000,
  })

/** Every delivery made against one order (an order rarely has more than 100). */
export const orderDeliveriesQuery = (poId: string) =>
  queryOptions({
    queryKey: salesOrderKeys.deliveries(poId),
    queryFn: ({ signal }) =>
      api
        .get<Sale[]>("/sales", { poId, limit: 100 }, signal)
        .then((r) => ({ items: r.data, total: r.meta?.total ?? 0 })),
  })

export type SalesOrderInput = {
  poNumber: string
  poDate: string
  companyId: string
  materialId: string
  quantityTons: string
  ratePerTon: string
  tolerancePercent?: string
  lifecycleStatus?: POLifecycle
  notes?: string
}

export function useSaveSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<SalesOrderInput> }) =>
      (id
        ? api.patch<Saved<SalesPO>>(`/sales-pos/${id}`, input)
        : api.post<Saved<SalesPO>>("/sales-pos", input)
      ).then((r) => r.data),
    // Orders drive open demand, "buy needed", the dashboard and the sidebar badge.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/** Closes a short-delivered order at what was delivered (the rate stays). */
export function useSettleOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<SalesPO>(`/sales-pos/${id}/settle`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
