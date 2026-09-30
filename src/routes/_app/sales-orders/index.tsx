import { createFileRoute } from "@tanstack/react-router"
import { OrdersPage } from "@/features/sales-orders/orders-page"
import { salesOrdersSearchSchema } from "@/features/sales-orders/search"

export const Route = createFileRoute("/_app/sales-orders/")({
  validateSearch: salesOrdersSearchSchema,
  component: function SalesOrdersRoute() {
    return <OrdersPage search={Route.useSearch()} />
  },
})
