import { z } from "zod"
import { dateParam, listSearchSchema, objectIdParam } from "@/lib/list-search"

/**
 * /supplier-stock?asOf=2026-09-15&supplier=<id>&material=<id>&used=true
 * asOf defaults to today; `used` also lists supplier stock that is fully used up.
 */
export const supplierStockSearchSchema = listSearchSchema.pick({ page: true, limit: true, q: true }).extend({
  asOf: dateParam,
  supplier: objectIdParam,
  material: objectIdParam,
  used: z.boolean().optional().catch(undefined),
})
export type SupplierStockSearch = z.infer<typeof supplierStockSearchSchema>
