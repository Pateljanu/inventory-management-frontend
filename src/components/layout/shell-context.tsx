/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type ShellState = {
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
}

const ShellContext = React.createContext<ShellState | null>(null)

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const value = React.useMemo(
    () => ({ paletteOpen, setPaletteOpen, helpOpen, setHelpOpen }),
    [paletteOpen, helpOpen]
  )
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell() {
  const ctx = React.useContext(ShellContext)
  if (!ctx) throw new Error("useShell must be used within ShellProvider")
  return ctx
}
