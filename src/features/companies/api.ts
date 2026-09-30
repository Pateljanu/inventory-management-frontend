import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { Company, CompanyType, Paginated } from "@/types/api"

export type CompanyListParams = {
  page?: number
  limit?: number
  search?: string
  type?: CompanyType
  /** Picker shortcut: "purchase" = suppliers + both, "sale" = buyers + both. */
  usage?: "purchase" | "sale"
  isActive?: boolean
}

export const companyKeys = {
  all: ["companies"] as const,
  lists: () => [...companyKeys.all, "list"] as const,
  list: (params: CompanyListParams) => [...companyKeys.lists(), params] as const,
  detail: (id: string) => [...companyKeys.all, "detail", id] as const,
}

export const companiesQuery = (params: CompanyListParams) =>
  queryOptions<Paginated<Company>, Error, Paginated<Company>, ReturnType<typeof companyKeys.list>>({
    queryKey: companyKeys.list(params),
    queryFn: async ({ signal }) => {
      const { data, meta } = await api.get<Company[]>("/companies", params, signal)
      return { items: data, meta: meta! }
    },
    placeholderData: keepPreviousData,
  })

export const companyQuery = (id: string) =>
  queryOptions({
    queryKey: companyKeys.detail(id),
    queryFn: ({ signal }) => api.get<Company>(`/companies/${id}`, undefined, signal).then((r) => r.data),
  })

/** What the create/edit form sends. Empty strings clear optional values on edit. */
export type CompanyInput = {
  name: string
  type: CompanyType
  gstNumber?: string
  address?: string
  contact?: { person?: string; phone?: string; email?: string }
  isActive?: boolean
}

export function useSaveCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Partial<CompanyInput> }) =>
      (id ? api.patch<Company>(`/companies/${id}`, input) : api.post<Company>("/companies", input)).then(
        (r) => r.data
      ),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(company._id), company)
      // Names appear in purchases, orders, deliveries and reports too.
      return queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "companies" || q.queryKey[1] !== "detail",
      })
    },
  })
}
