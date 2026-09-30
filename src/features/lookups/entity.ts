import { queryOptions, useQuery } from "@tanstack/react-query"
import { companyQuery } from "@/features/companies/api"
import { materialQuery } from "@/features/materials/api"
import { fetchCompanyOptions, fetchMaterialOptions, lookupKeys, type EntityOption } from "./api"

/** The kinds of picker the app needs ("company" = any type, for reports). */
export type EntityKind = "supplier" | "buyer" | "company" | "material"

export const ENTITY_LABELS: Record<EntityKind, { label: string; noun: string; placeholder: string }> = {
  supplier: { label: "Supplier", noun: "suppliers", placeholder: "Choose a supplier" },
  buyer: { label: "Buyer", noun: "buyers", placeholder: "Choose a buyer" },
  company: { label: "Company", noun: "companies", placeholder: "Choose a company" },
  material: { label: "Material", noun: "materials", placeholder: "Choose a material" },
}

/** First 20 active matches for a search text; cached briefly so reopening a picker is instant. */
export const entityOptionsQuery = (kind: EntityKind, q: string) =>
  queryOptions({
    queryKey: [...lookupKeys.all, kind, q] as const,
    queryFn: ({ signal }) =>
      kind === "material"
        ? fetchMaterialOptions(q, signal)
        : fetchCompanyOptions(
            kind === "supplier" ? "purchase" : kind === "buyer" ? "sale" : undefined,
            q,
            signal
          ),
    staleTime: 60_000,
  })

/** Name of a record known only by id (from the URL), for filter chips and pickers. */
export function useEntityOption(kind: EntityKind, id: string | undefined): EntityOption | null {
  const company = useQuery({ ...companyQuery(id ?? ""), enabled: Boolean(id) && kind !== "material" })
  const material = useQuery({ ...materialQuery(id ?? ""), enabled: Boolean(id) && kind === "material" })
  if (!id) return null
  const record = kind === "material" ? material.data : company.data
  return { _id: id, name: record?.name ?? "…" }
}
