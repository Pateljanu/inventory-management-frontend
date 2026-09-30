import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { MaterialDetailPage } from "@/features/materials/material-detail-page"
import { materialQuery } from "@/features/materials/api"
import { RecordNotFound } from "@/components/common/record-not-found"
import { isApiError } from "@/lib/api-client"

export const Route = createFileRoute("/_app/materials/$materialId")({
  validateSearch: z.object({ edit: z.boolean().optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    if (!/^[a-f\d]{24}$/i.test(params.materialId)) throw notFound()
    try {
      const material = await context.queryClient.ensureQueryData(materialQuery(params.materialId))
      return { crumb: material.name }
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: () => (
    <RecordNotFound what="material" backTo="/materials" backLabel="Back to materials" />
  ),
  component: function MaterialRoute() {
    const { materialId } = Route.useParams()
    const { edit } = Route.useSearch()
    return <MaterialDetailPage materialId={materialId} editing={Boolean(edit)} />
  },
})
