import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { formatTons } from "@/lib/format"
import type { EntityOption } from "@/features/lookups/api"
import type { Paginated, Sale, SaleCapacity, SalesPO, Saved } from "@/types/api"

export type DeliveryListParams = {
  page?: number
  limit?: number
  search?: string
  from?: string
  to?: string
  /** Buyer. */
  companyId?: string
  /** Supplier whose stock was used. */
  sourceCompanyId?: string
  materialId?: string
  poId?: string
}

export type CapacityParams = {
  poId: string
  saleDate: string
  sourceCompanyId?: string
  /** The delivery being edited, so it is not counted against itself. */
  excludeSaleId?: string
}

export const deliveryKeys = {
  all: ["deliveries"] as const,
  list: (params: DeliveryListParams) => [...deliveryKeys.all, "list", params] as const,
  detail: (id: string) => [...deliveryKeys.all, "detail", id] as const,
  capacity: (params: CapacityParams) => [...deliveryKeys.all, "capacity", params] as const,
  openOrders: () => [...deliveryKeys.all, "open-orders"] as const,
}

export const deliveriesQuery = (params: DeliveryListParams) =>
  queryOptions<Paginated<Sale>, Error, Paginated<Sale>, ReturnType<typeof deliveryKeys.list>>({
    queryKey: deliveryKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<Sale[]>("/sales", params, signal)
      return { items: data, meta: meta! }
    },
    placeholderData: keepPreviousData,
  })

export const deliveryQuery = (id: string) =>
  queryOptions({
    queryKey: deliveryKeys.detail(id),
    queryFn: ({ signal }) => api.get<Sale>(`/sales/${id}`, undefined, signal).then((r) => r.data),
  })

/**
 * Live limits for the delivery form. While new limits load for the same order, the previous
 * numbers stay on screen (marked as updating); a different order never shows another's numbers.
 */
export const capacityQuery = (params: CapacityParams) =>
  queryOptions<SaleCapacity, Error, SaleCapacity, ReturnType<typeof deliveryKeys.capacity>>({
    queryKey: deliveryKeys.capacity(params),
    queryFn: ({ signal }) => api.get<SaleCapacity>("/sales/capacity", params, signal).then((r) => r.data),
    placeholderData: (previous) => (previous?.poId === params.poId ? previous : undefined),
    // Other people may deliver meanwhile; the server re-checks on save either way.
    staleTime: 10_000,
  })

/**
 * Orders that can take a delivery, for the order picker: "PO-0142" with "Bharat Castings ·
 * 11.750 t left". A yard rarely has more than 100 open orders; the picker filters them locally.
 */
export const openOrderOptionsQuery = () =>
  queryOptions({
    queryKey: deliveryKeys.openOrders(),
    queryFn: ({ signal }) =>
      api
        .get<SalesPO[]>("/sales-pos", { status: ["PENDING", "PARTIALLY_SUPPLIED"], limit: 100 }, signal)
        .then((r) => r.data.map(toOrderOption)),
    staleTime: 30_000,
  })

export const toOrderOption = (po: SalesPO): EntityOption => ({
  _id: po._id,
  name: po.poNumber,
  meta: `${po.companyId.name} · ${formatTons(po.remainingQuantityTons, { unit: true })} left`,
})

export type DeliveryInput = {
  saleDate: string
  poId: string
  sourceCompanyId: string
  quantityTons: string
  vehicleNumber?: string
  challanNumber?: string
  notes?: string
}

/** Pessimistic: stock and order balances change only once the server accepts the delivery. */
export function useSaveDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<DeliveryInput> }) =>
      (id ? api.patch<Saved<Sale>>(`/sales/${id}`, input) : api.post<Saved<Sale>>("/sales", input)).then(
        (r) => r.data
      ),
    // A delivery moves stock, supplier stock, order balances, the dashboard and the badge.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
