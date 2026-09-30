import { useState } from "react"

/**
 * A number that goes up each time `open` turns true. Used as a React key so a create form
 * starts empty every time it opens, instead of showing what was abandoned last time. (Derived
 * during render, React's pattern for "reset state when a prop changes".)
 */
export function useOpenSession(open: boolean): number {
  const [session, setSession] = useState(open ? 1 : 0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((s) => s + 1)
  }
  return session
}
