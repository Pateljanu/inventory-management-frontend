import { createFileRoute } from "@tanstack/react-router"
import { MaterialsPage } from "@/features/materials/materials-page"
import { materialsSearchSchema } from "@/features/materials/search"

export const Route = createFileRoute("/_app/materials/")({
  validateSearch: materialsSearchSchema,
  component: function MaterialsRoute() {
    return <MaterialsPage search={Route.useSearch()} />
  },
})
