import { useSyncExternalStore } from "react"
import { WifiOff } from "lucide-react"

function subscribe(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

/** Not dismissible: while offline nothing can be saved. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  )
  if (online) return null
  return (
    <div
      role="status"
      className="flex min-h-10 items-center gap-2 border-b bg-warning/15 px-4 py-2 text-sm text-foreground lg:px-6"
    >
      <WifiOff className="size-4 shrink-0" />
      You&apos;re offline. Changes can&apos;t be saved until the connection is back.
    </div>
  )
}
