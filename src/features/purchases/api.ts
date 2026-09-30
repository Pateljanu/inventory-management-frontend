import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Paginated, Purchase, Saved } from "@/types/api"

export type PurchaseListParams = {
  page?: number
  limit?: number
  search?: string
  from?: string
  to?: string
  companyId?: string
  materialId?: string
}

export const purchaseKeys = {
  all: ["purchases"] as const,
  list: (params: PurchaseListParams) => [...purchaseKeys.all, "list", params] as const,
  detail: (id: string) => [...purchaseKeys.all, "detail", id] as const,
  lastRate: (companyId: string, materialId: string) =>
    [...purchaseKeys.all, "last", companyId, materialId] as const,
}

export const purchasesQuery = (params: PurchaseListParams) =>
  queryOptions<Paginated<Purchase>, Error, Paginated<Purchase>, ReturnType<typeof purchaseKeys.list>>({
    queryKey: purchaseKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<Purchase[]>("/purchases", params, signal)
      return { items: data, meta: meta! }
    },
    placeholderData: keepPreviousData,
  })

export const purchaseQuery = (id: string) =>
  queryOptions({
    queryKey: purchaseKeys.detail(id),
    queryFn: ({ signal }) => api.get<Purchase>(`/purchases/${id}`, undefined, signal).then((r) => r.data),
  })

/** The most recent purchase of this material from this supplier (for the "last rate" default). */
export const lastPurchaseQuery = (companyId: string, materialId: string) =>
  queryOptions({
    queryKey: purchaseKeys.lastRate(companyId, materialId),
    queryFn: ({ signal }) =>
      api
        .get<Purchase[]>("/purchases", { companyId, materialId, limit: 1 }, signal)
        .then((r) => r.data[0] ?? null),
    staleTime: 5 * 60_000,
  })

export type PurchaseInput = {
  purchaseDate: string
  companyId: string
  materialId: string
  quantityTons: string
  ratePerTon: string
  vehicleNumber?: string
  invoiceNumber?: string
  notes?: string
}

/** Stock and money saves are pessimistic: the list updates only after the server accepts. */
export function useSavePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<PurchaseInput> }) =>
      (id
        ? api.patch<Saved<Purchase>>(`/purchases/${id}`, input)
        : api.post<Saved<Purchase>>("/purchases", input)
      ).then((r) => r.data),
    // Purchases change stock, supplier stock, the dashboard and material pages.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
