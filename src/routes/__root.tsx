import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/error-state"
import type { RouterContext } from "@/router"

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-lg p-6">
      <ErrorState error={error} onRetry={reset} />
    </div>
  ),
})

function RootLayout() {
  return (
    <TooltipProvider delay={300}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Outlet />
      <Toaster position="bottom-right" visibleToasts={3} offset={16} mobileOffset={{ bottom: 80 }} />
    </TooltipProvider>
  )
}

function NotFound() {
  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <EmptyState
        kind="no-results"
        title="This page doesn't exist"
        description="The link may be old or mistyped."
        action={<Button render={<Link to="/" />}>Go to dashboard</Button>}
      />
    </div>
  )
}
