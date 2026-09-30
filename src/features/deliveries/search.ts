import { z } from "zod"
import { dateParam, listSearchSchema, objectIdParam } from "@/lib/list-search"

/**
 * /deliveries?from=…&to=…&buyer=<id>&source=<id>&material=<id>&q=CH-5
 *   &create=true&poId=<id>   ("Deliver" on an order: the form opens with that order chosen)
 */
export const deliveriesSearchSchema = listSearchSchema.extend({
  from: dateParam,
  to: dateParam,
  buyer: objectIdParam,
  /** Supplier whose stock was used. */
  source: objectIdParam,
  material: objectIdParam,
  /** Pre-selects this order in the create form. */
  poId: objectIdParam,
})
export type DeliveriesSearch = z.infer<typeof deliveriesSearchSchema>
