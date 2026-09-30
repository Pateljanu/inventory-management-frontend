import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Remembers the id of a just-saved record for the length of the "row saved" animation
 * (success tint held 1 s, then faded), so the list can mark and scroll to it.
 */
export function useHighlight(duration = 2500) {
  const [id, setId] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const highlight = useCallback(
    (next: string) => {
      window.clearTimeout(timer.current)
      setId(next)
      timer.current = window.setTimeout(() => setId(null), duration)
    },
    [duration]
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [id, highlight] as const
}
