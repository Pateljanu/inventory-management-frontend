import { createFileRoute } from "@tanstack/react-router"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { dashboardSearchSchema } from "@/features/dashboard/search"

export const Route = createFileRoute("/_app/")({
  staticData: { title: "Dashboard" },
  validateSearch: dashboardSearchSchema,
  component: function DashboardRoute() {
    return <DashboardPage search={Route.useSearch()} />
  },
})
