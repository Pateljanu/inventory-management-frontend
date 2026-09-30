import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/sales-orders")({
  staticData: { title: "Sales Orders" },
  component: Outlet,
})
