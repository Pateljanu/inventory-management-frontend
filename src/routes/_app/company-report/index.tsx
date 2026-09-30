import { createFileRoute } from "@tanstack/react-router"
import { CompanyReportPage } from "@/features/company-report/company-report-page"
import { companyReportSearchSchema } from "@/features/company-report/search"

export const Route = createFileRoute("/_app/company-report/")({
  staticData: { title: "Company report" },
  validateSearch: companyReportSearchSchema,
  component: function CompanyReportRoute() {
    return <CompanyReportPage search={Route.useSearch()} />
  },
})
