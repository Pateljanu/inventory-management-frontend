import { createFileRoute } from "@tanstack/react-router"
import { CompaniesPage } from "@/features/companies/companies-page"
import { companiesSearchSchema } from "@/features/companies/search"

export const Route = createFileRoute("/_app/companies/")({
  validateSearch: companiesSearchSchema,
  component: function CompaniesRoute() {
    return <CompaniesPage search={Route.useSearch()} />
  },
})
