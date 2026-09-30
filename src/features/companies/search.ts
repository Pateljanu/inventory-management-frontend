import { z } from "zod"
import { listSearchSchema } from "@/lib/list-search"

/** /companies?q=&type=PURCHASE&status=active&page=2&create=true&edit=<id> */
export const companiesSearchSchema = listSearchSchema.extend({
  type: z.enum(["PURCHASE", "SALE", "BOTH"]).optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
})
export type CompaniesSearch = z.infer<typeof companiesSearchSchema>
