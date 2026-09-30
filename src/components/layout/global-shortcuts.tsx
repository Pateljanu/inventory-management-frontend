import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"
import { CREATE_ACTIONS, createTarget, type CreateAction } from "./nav"

/*
 * Tally-style create shortcuts. Browsers capture F5/F11, so Alt combinations are primary and
 * F8 (sales/delivery) / F9 (purchase) are aliases. Ctrl+K and Ctrl+B live in the palette and
 * sidebar themselves.
 */
const ALT_KEYS: Record<string, CreateAction["id"]> = { p: "purchase", o: "sales-order", d: "delivery" }
const F_KEYS: Record<string, CreateAction["id"]> = { F8: "delivery", F9: "purchase" }

export function GlobalShortcuts() {
  const navigate = useNavigate()
  const { user } = useSession()
  const canWrite = can(user, "write")

  useEffect(() => {
    if (!canWrite) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey) return
      // event.code keeps Alt+P working on layouts where Alt changes the typed character.
      const letter = event.code.startsWith("Key") ? event.code.slice(3).toLowerCase() : ""
      const id = event.altKey ? ALT_KEYS[letter] : F_KEYS[event.key]
      const action = CREATE_ACTIONS.find((a) => a.id === id)
      if (!action) return
      event.preventDefault()
      navigate(createTarget(action))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canWrite, navigate])

  return null
}
