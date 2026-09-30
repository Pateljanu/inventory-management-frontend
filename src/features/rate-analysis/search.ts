import { z } from "zod"
import { dateParam, objectIdParam } from "@/lib/list-search"

/** /rate-analysis?from=2026-04-01&to=2026-09-28&material=<id>. Default period: this FY. */
export const rateAnalysisSearchSchema = z.object({
  from: dateParam,
  to: dateParam,
  material: objectIdParam,
})
export type RateAnalysisSearch = z.infer<typeof rateAnalysisSearchSchema>
