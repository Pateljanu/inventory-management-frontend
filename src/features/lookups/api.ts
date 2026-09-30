import { api } from "@/lib/api-client"
import type { Company, Material, Ref } from "@/types/api"

/*
 * Option lists for pickers: active records only (inactive ones can't be used for new
 * transactions), first 20 matches.
 */

export type EntityOption = Ref & { meta?: string }

const LIMIT = 20

export const lookupKeys = {
  all: ["lookups"] as const,
}

/** usage: suppliers ("purchase"), buyers ("sale"), or undefined for every company. */
export function fetchCompanyOptions(usage: "purchase" | "sale" | undefined, q: string, signal?: AbortSignal) {
  return api
    .get<Company[]>("/companies", { usage, isActive: true, search: q || undefined, limit: LIMIT }, signal)
    .then((r) => r.data.map((c): EntityOption => ({ _id: c._id, name: c.name })))
}

export function fetchMaterialOptions(q: string, signal?: AbortSignal) {
  return api
    .get<Material[]>("/materials", { isActive: true, search: q || undefined, limit: LIMIT }, signal)
    .then((r) => r.data.map((m): EntityOption => ({ _id: m._id, name: m.name })))
}
