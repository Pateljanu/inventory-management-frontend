import { createFileRoute, notFound } from "@tanstack/react-router"
import { z } from "zod"
import { OrderDetailPage } from "@/features/sales-orders/order-detail-page"
import { salesOrderQuery } from "@/features/sales-orders/api"
import { RecordNotFound } from "@/components/common/record-not-found"
import { isApiError } from "@/lib/api-client"

export const Route = createFileRoute("/_app/sales-orders/$orderId")({
  validateSearch: z.object({ edit: z.boolean().optional().catch(undefined) }),
  loader: async ({ context, params }) => {
    if (!/^[a-f\d]{24}$/i.test(params.orderId)) throw notFound()
    try {
      const po = await context.queryClient.ensureQueryData(salesOrderQuery(params.orderId))
      return { crumb: po.poNumber }
    } catch (error) {
      if (isApiError(error) && error.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: () => (
    <RecordNotFound what="order" backTo="/sales-orders" backLabel="Back to sales orders" />
  ),
  component: function OrderRoute() {
    const { orderId } = Route.useParams()
    const { edit } = Route.useSearch()
    return <OrderDetailPage orderId={orderId} editing={Boolean(edit)} />
  },
})
