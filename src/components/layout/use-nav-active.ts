import { useLocation } from "@tanstack/react-router"

/** Active when the path is the item's page or one of its children ("/" matches only itself). */
export function useIsActive() {
  const pathname = useLocation({ select: (l) => l.pathname })
  return (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`))
}
