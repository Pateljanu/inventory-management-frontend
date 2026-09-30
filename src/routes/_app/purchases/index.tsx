import { createFileRoute } from "@tanstack/react-router"
import { PurchasesPage } from "@/features/purchases/purchases-page"
import { purchasesSearchSchema } from "@/features/purchases/search"

export const Route = createFileRoute("/_app/purchases/")({
  validateSearch: purchasesSearchSchema,
  component: function PurchasesRoute() {
    return <PurchasesPage search={Route.useSearch()} />
  },
})
