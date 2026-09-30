import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { CircleHelp, Ellipsis, Plus, type LucideIcon } from "lucide-react"
import { useShell } from "./shell-context"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CREATE_ACTIONS, createTarget, NAV_ITEMS, navItem, type AppPath } from "./nav"
import { useIsActive } from "./use-nav-active"
import { useSession } from "@/features/auth/session"
import { openOrdersCountQuery } from "@/features/sales-orders/api"
import { can } from "@/lib/permissions"
import { cn } from "@/lib/utils"

type Slot = { id: string; label: string; to: AppPath; icon: LucideIcon; badge?: number }

function NavSlot({ slot, active }: { slot: Slot; active: boolean }) {
  return (
    <Link
      to={slot.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        active && "font-semibold text-primary"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-14 items-center justify-center rounded-full transition-colors duration-(--duration-fast)",
          active && "bg-accent"
        )}
      >
        <slot.icon className="size-5" />
      </span>
      <span className="truncate">{slot.label}</span>
      {slot.badge ? (
        <span className="absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums">
          {slot.badge > 99 ? "99+" : slot.badge}
        </span>
      ) : null}
    </Link>
  )
}

/** Phone navigation (< 768 px): four destinations, a centre "New" button and "More". */
export function BottomNav() {
  const { user } = useSession()
  const isActive = useIsActive()
  const navigate = useNavigate()
  const openOrders = useQuery(openOrdersCountQuery())
  const [moreOpen, setMoreOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const { setHelpOpen } = useShell()
  const canWrite = can(user, "write")

  const slot = (id: string, label: string, badge?: number): Slot => {
    const item = navItem(id)
    return { id, label, to: item.to, icon: item.icon, badge }
  }
  const home = slot("dashboard", "Home")
  const purchases = slot("purchases", "Purchases")
  const orders = slot("sales-orders", "Orders", openOrders.data)
  const stock = slot("supplier-stock", "Stock")

  const left = [home, purchases]
  const right = canWrite ? [orders] : [orders, stock]
  const inBar = new Set([...left, ...right].map((s) => s.id))
  const moreItems = NAV_ITEMS.filter((i) => !inBar.has(i.id))
  const moreActive = moreItems.some((i) => isActive(i.to))

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {left.map((s) => (
          <NavSlot key={s.id} slot={s} active={isActive(s.to)} />
        ))}
        {canWrite ? (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="flex flex-1 flex-col items-center justify-end gap-1 pb-2 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <span className="-mt-4 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
              <Plus className="size-6" />
            </span>
            New
          </button>
        ) : null}
        {right.map((s) => (
          <NavSlot key={s.id} slot={s} active={isActive(s.to)} />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-current={moreActive ? "page" : undefined}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            moreActive && "font-semibold text-primary"
          )}
        >
          <span
            className={cn(
              "flex h-7 w-14 items-center justify-center rounded-full",
              moreActive && "bg-accent"
            )}
          >
            <Ellipsis className="size-5" />
          </span>
          More
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <ul className="px-2 pb-4">
            {moreItems.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  aria-current={isActive(item.to) ? "page" : undefined}
                  className="flex h-12 items-center gap-3 rounded-lg px-3 text-base hover:bg-muted aria-[current=page]:bg-accent aria-[current=page]:font-medium"
                >
                  <item.icon className="size-5 text-muted-foreground" />
                  {item.title}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false)
                  setHelpOpen(true)
                }}
                className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CircleHelp className="size-5 text-muted-foreground" />
                Help &amp; shortcuts
              </button>
            </li>
          </ul>
        </SheetContent>
      </Sheet>

      <Sheet open={newOpen} onOpenChange={setNewOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>What are you recording?</SheetTitle>
          </SheetHeader>
          <ul className="px-2 pb-4">
            {CREATE_ACTIONS.slice(0, 3).map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => {
                    setNewOpen(false)
                    navigate(createTarget(action))
                  }}
                  className="flex h-16 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                    <action.icon className="size-6" />
                  </span>
                  <span>
                    <span className="block font-semibold">{action.title}</span>
                    <span className="block text-sm text-muted-foreground">{action.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  )
}
