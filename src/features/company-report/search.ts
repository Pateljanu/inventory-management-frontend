import { z } from "zod"
import { dateParam, objectIdParam } from "@/lib/list-search"

/** /company-report?company=<id>&from=2026-04-01&to=2026-09-28&material=<id>. Default period: this FY. */
export const companyReportSearchSchema = z.object({
  company: objectIdParam,
  from: dateParam,
  to: dateParam,
  material: objectIdParam,
})
export type CompanyReportSearch = z.infer<typeof companyReportSearchSchema>
