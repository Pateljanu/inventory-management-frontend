import { z } from "zod"
import { listSearchSchema } from "@/lib/list-search"

/** /materials?q=&status=active&page=2&create=true&edit=<id> */
export const materialsSearchSchema = listSearchSchema.extend({
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
})
export type MaterialsSearch = z.infer<typeof materialsSearchSchema>
