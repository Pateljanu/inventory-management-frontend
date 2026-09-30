import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/companies")({
  staticData: { title: "Companies" },
  component: Outlet,
})
