import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Material, Paginated } from "@/types/api"

export type MaterialListParams = { page?: number; limit?: number; search?: string; isActive?: boolean }

export const materialKeys = {
  all: ["materials"] as const,
  lists: () => [...materialKeys.all, "list"] as const,
  list: (params: MaterialListParams) => [...materialKeys.lists(), params] as const,
  detail: (id: string) => [...materialKeys.all, "detail", id] as const,
}

export const materialsQuery = (params: MaterialListParams) =>
  queryOptions<Paginated<Material>, Error, Paginated<Material>, ReturnType<typeof materialKeys.list>>({
    queryKey: materialKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<Material[]>("/materials", params, signal)
      return { items: data, meta: meta! }
    },
    placeholderData: keepPreviousData,
  })

/** Includes currentStockTons (stock in the yard today). */
export const materialQuery = (id: string) =>
  queryOptions({
    queryKey: materialKeys.detail(id),
    queryFn: ({ signal }) => api.get<Material>(`/materials/${id}`, undefined, signal).then((r) => r.data),
  })

export type MaterialInput = {
  name: string
  /** Decimal string, 3 dp. */
  openingStockTons?: string
  notes?: string
  isActive?: boolean
}

export function useSaveMaterial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<MaterialInput> }) =>
      (id ? api.patch<Material>(`/materials/${id}`, input) : api.post<Material>("/materials", input)).then(
        (r) => r.data
      ),
    // Opening stock changes stock everywhere (dashboard, reports), so refresh broadly.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
