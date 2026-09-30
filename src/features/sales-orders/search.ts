import { z } from "zod"
import { dateParam, listSearchSchema, objectIdParam } from "@/lib/list-search"
import type { PODisplayStatus } from "@/types/api"

/** Quick views over the derived status. "Open" = Pending + Partly delivered. */
export const ORDER_VIEWS = {
  open: { label: "Open", status: ["PENDING", "PARTIALLY_SUPPLIED"] },
  partly: { label: "Partly delivered", status: ["PARTIALLY_SUPPLIED"] },
  completed: { label: "Completed", status: ["COMPLETED"] },
  cancelled: { label: "Cancelled", status: ["CANCELLED"] },
  all: { label: "All", status: undefined },
} satisfies Record<string, { label: string; status: PODisplayStatus[] | undefined }>

export type OrderView = keyof typeof ORDER_VIEWS

/** /sales-orders?view=open&from=&to=&buyer=<id>&material=<id>&q=PO-01&create=true&edit=<id> */
export const salesOrdersSearchSchema = listSearchSchema.extend({
  view: z
    .enum(Object.keys(ORDER_VIEWS) as [OrderView, ...OrderView[]])
    .optional()
    .catch(undefined),
  from: dateParam,
  to: dateParam,
  buyer: objectIdParam,
  material: objectIdParam,
})
export type SalesOrdersSearch = z.infer<typeof salesOrdersSearchSchema>
