/*
 * Remembers the last supplier/material/buyer used on this device, so the next form starts with
 * them filled in (most people keep defaults). Values are small { _id, name } records.
 */

const PREFIX = "metalix.last."

export function readLastUsed<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeLastUsed<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage blocked: defaults simply won't be remembered.
  }
}

/** Vehicle numbers are stored uppercase without spaces ("GJ03AX4521"), like the backend does. */
export const normalizeCode = (value: string) => value.replace(/\s+/g, "").toUpperCase()
