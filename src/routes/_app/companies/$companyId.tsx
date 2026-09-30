import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { CompanyDetailPage } from "@/features/companies/company-detail-page"
import { companyQuery } from "@/features/companies/api"
import { RecordNotFound } from "@/components/common/record-not-found"
import { isApiError } from "@/lib/api-client"

export const Route = createFileRoute("/_app/companies/$companyId")({
  validateSearch: z.object({ edit: z.boolean().optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    if (!/^[a-f\d]{24}$/i.test(params.companyId)) throw notFound()
    try {
      const company = await context.queryClient.ensureQueryData(companyQuery(params.companyId))
      return { crumb: company.name }
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: () => (
    <RecordNotFound what="company" backTo="/companies" backLabel="Back to companies" />
  ),
  component: function CompanyRoute() {
    const { companyId } = Route.useParams()
    const { edit } = Route.useSearch()
    return <CompanyDetailPage companyId={companyId} editing={Boolean(edit)} />
  },
})
