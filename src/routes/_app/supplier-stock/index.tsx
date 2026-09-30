import { createFileRoute } from "@tanstack/react-router"
import { SupplierStockPage } from "@/features/supplier-stock/supplier-stock-page"
import { supplierStockSearchSchema } from "@/features/supplier-stock/search"

export const Route = createFileRoute("/_app/supplier-stock/")({
  staticData: { title: "Supplier stock" },
  validateSearch: supplierStockSearchSchema,
  component: function SupplierStockRoute() {
    return <SupplierStockPage search={Route.useSearch()} />
  },
})
