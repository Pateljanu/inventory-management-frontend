/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

/*
 * Per-device display preferences: theme (light / dark / system), the high-contrast
 * "Sunlight" mode for outdoor use, and an in-app "Reduce animations" switch.
 * index.html applies theme and sunlight before first paint to avoid a flash.
 */

export type Theme = "light" | "dark" | "system"

type Preferences = {
  theme: Theme
  resolvedTheme: "light" | "dark"
  sunlight: boolean
  reduceMotion: boolean
  setTheme: (theme: Theme) => void
  setSunlight: (on: boolean) => void
  setReduceMotion: (on: boolean) => void
}

const KEYS = { theme: "metalix.theme", sunlight: "metalix.sunlight", motion: "metalix.motion" }
const DARK_QUERY = "(prefers-color-scheme: dark)"

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the preference lasts for this visit only.
  }
}

const systemDark = () => window.matchMedia(DARK_QUERY).matches

const PreferencesContext = React.createContext<Preferences | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    const t = read(KEYS.theme)
    return t === "light" || t === "dark" ? t : "system"
  })
  const [sunlight, setSunlightState] = React.useState(() => read(KEYS.sunlight) === "1")
  const [reduceMotion, setReduceMotionState] = React.useState(() => read(KEYS.motion) === "reduced")
  const [systemIsDark, setSystemIsDark] = React.useState(systemDark)

  React.useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystemIsDark(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme = theme === "system" ? (systemIsDark ? "dark" : "light") : theme

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    // Sunlight is a light-only, maximum-contrast theme.
    root.classList.toggle("contrast", sunlight && resolvedTheme === "light")
    if (reduceMotion) root.dataset.motion = "reduced"
    else delete root.dataset.motion
  }, [resolvedTheme, sunlight, reduceMotion])

  const value = React.useMemo<Preferences>(
    () => ({
      theme,
      resolvedTheme,
      sunlight,
      reduceMotion,
      setTheme: (t) => {
        write(KEYS.theme, t)
        setThemeState(t)
      },
      setSunlight: (on) => {
        write(KEYS.sunlight, on ? "1" : "0")
        setSunlightState(on)
      },
      setReduceMotion: (on) => {
        write(KEYS.motion, on ? "reduced" : "full")
        setReduceMotionState(on)
      },
    }),
    [theme, resolvedTheme, sunlight, reduceMotion]
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): Preferences {
  const ctx = React.useContext(PreferencesContext)
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider")
  return ctx
}
