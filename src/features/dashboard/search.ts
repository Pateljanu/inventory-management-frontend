import { z } from "zod"
import { dateParam } from "@/lib/list-search"

/** /?from=2026-09-01&to=2026-09-27. Without both, the dashboard shows this month so far. */
export const dashboardSearchSchema = z.object({ from: dateParam, to: dateParam })
export type DashboardSearch = z.infer<typeof dashboardSearchSchema>
