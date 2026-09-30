import { createFileRoute } from "@tanstack/react-router"
import { DeliveriesPage } from "@/features/deliveries/deliveries-page"
import { deliveriesSearchSchema } from "@/features/deliveries/search"

export const Route = createFileRoute("/_app/deliveries/")({
  validateSearch: deliveriesSearchSchema,
  component: function DeliveriesRoute() {
    return <DeliveriesPage search={Route.useSearch()} />
  },
})
