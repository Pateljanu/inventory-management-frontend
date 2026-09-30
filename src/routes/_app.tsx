import { createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { AppShell } from "@/components/layout/app-shell"
import { ErrorState } from "@/components/common/error-state"
import { Spinner } from "@/components/ui/spinner"
import { getSession, initSession, retryInitSession } from "@/features/auth/session"
import { ApiError } from "@/lib/api-client"

/** Every signed-in page lives under this pathless layout. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    await initSession()
    const { status } = getSession()
    if (status === "unreachable") {
      throw new ApiError(0, { code: "NETWORK_ERROR", message: "Could not reach the server." })
    }
    // "expired" stays on the page: the re-login dialog covers it and keeps typed work.
    if (status !== "authenticated" && status !== "expired") {
      throw redirect({ to: "/login", search: location.href === "/" ? {} : { redirect: location.href } })
    }
  },
  component: AppShell,
  pendingComponent: Splash,
  errorComponent: BootError,
})

function Splash() {
  return (
    <div
      className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <Spinner /> Loading Metalix…
    </div>
  )
}

function BootError({ error }: { error: unknown }) {
  const router = useRouter()
  return (
    <div className="mx-auto flex min-h-svh max-w-lg items-center p-6">
      <ErrorState
        error={error}
        onRetry={async () => {
          await retryInitSession()
          router.invalidate()
        }}
      />
    </div>
  )
}
