import { createRouter } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { routeTree } from "./routeTree.gen"

export type RouterContext = { queryClient: QueryClient }

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Loaders read through the Query cache, so the router itself never caches.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingMs: 500,
    defaultPendingMinMs: 500,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
  interface StaticDataRouteOption {
    /** Page name used in breadcrumbs and the phone header. */
    title?: string
  }
}
