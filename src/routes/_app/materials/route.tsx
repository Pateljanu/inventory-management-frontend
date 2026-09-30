import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/materials")({
  staticData: { title: "Materials" },
  component: Outlet,
})
