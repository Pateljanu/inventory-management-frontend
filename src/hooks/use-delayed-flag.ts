import { useEffect, useState } from "react"
import { LOADER_DELAY } from "@/lib/timing"

/**
 * True only after `flag` has stayed true for `delay` ms. Fast responses never flash a
 * skeleton or spinner; slow ones show it.
 */
export function useDelayedFlag(flag: boolean, delay = LOADER_DELAY): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!flag) {
      const id = window.setTimeout(() => setShown(false), 0)
      return () => window.clearTimeout(id)
    }
    const id = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(id)
  }, [flag, delay])
  return flag && shown
}
