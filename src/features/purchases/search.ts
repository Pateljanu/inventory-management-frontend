import { z } from "zod"
import { dateParam, listSearchSchema, objectIdParam } from "@/lib/list-search"

/** /purchases?from=2026-09-01&to=2026-09-30&supplier=<id>&material=<id>&q=GJ03&create=true&repeat=<id> */
export const purchasesSearchSchema = listSearchSchema.extend({
  from: dateParam,
  to: dateParam,
  supplier: objectIdParam,
  material: objectIdParam,
  /** Opens the create sheet pre-filled from this purchase ("Repeat purchase"). */
  repeat: objectIdParam,
})
export type PurchasesSearch = z.infer<typeof purchasesSearchSchema>
