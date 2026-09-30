import { useEffect, useRef } from "react"
import { Outlet, useNavigate, useRouter } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { SiteHeader } from "./site-header"
import { BottomNav } from "./bottom-nav"
import { CommandPalette } from "./command-palette"
import { GlobalShortcuts } from "./global-shortcuts"
import { HelpDialog } from "./help-dialog"
import { OfflineBanner } from "./offline-banner"
import { ShellProvider } from "./shell-context"
import { ConfirmProvider } from "@/components/common/confirm-dialog"
import { useSession } from "@/features/auth/session"
import { SessionExpiredDialog } from "@/features/auth/session-expired-dialog"
import { notify } from "@/lib/notify"

function readSidebarCookie(): boolean {
  const match = document.cookie.match(/(?:^|; )sidebar_state=(true|false)/)
  return match ? match[1] === "true" : true
}

/** Sends the user to the login page when the session ends (expiry, or logout in another tab). */
function useSessionEndRedirect() {
  const { status, endReason } = useSession()
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const handled = useRef(false)

  useEffect(() => {
    if (status !== "anonymous" || handled.current) return
    handled.current = true
    queryClient.clear()
    if (endReason === "expired") {
      notify.info("Your session has ended", { description: "Log in again to continue." })
    }
    const here = router.state.location.href
    navigate({ to: "/login", search: endReason === "expired" ? { redirect: here } : {} })
  }, [status, endReason, navigate, router, queryClient])
}

export function AppShell() {
  useSessionEndRedirect()

  return (
    <ShellProvider>
      <ConfirmProvider>
        <SidebarProvider defaultOpen={readSidebarCookie()}>
          <AppSidebar />
          <SidebarInset className="min-w-0 md:border">
            <SiteHeader />
            <OfflineBanner />
            <div
              id="main"
              className="flex flex-1 flex-col gap-6 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6 lg:p-6"
            >
              <Outlet />
            </div>
          </SidebarInset>
          <BottomNav />
          <CommandPalette />
          <GlobalShortcuts />
          <HelpDialog />
          <SessionExpiredDialog />
        </SidebarProvider>
      </ConfirmProvider>
    </ShellProvider>
  )
}
