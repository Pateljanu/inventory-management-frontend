import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/deliveries")({
  staticData: { title: "Deliveries" },
  component: Outlet,
})
