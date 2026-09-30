import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { CircleHelp } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { CREATE_ACTIONS, NAV_GROUPS, createTarget } from "./nav"
import { useShell } from "./shell-context"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"

/**
 * Ctrl+K palette: Create (OWNER only) and Go to. Server-side search for companies, materials
 * and sales orders is added once those screens exist.
 */
export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, setHelpOpen } = useShell()
  const { user } = useSession()
  const navigate = useNavigate()
  const canWrite = can(user, "write")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setPaletteOpen(!paletteOpen)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [paletteOpen, setPaletteOpen])

  const go = (to: (typeof CREATE_ACTIONS)[number]["to"]) => {
    setPaletteOpen(false)
    navigate({ to })
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Search or jump to"
      description="Type a page or an action"
    >
      <Command>
        <CommandInput placeholder="Type a page or an action…" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try another word.</CommandEmpty>
          {canWrite ? (
            <>
              <CommandGroup heading="Create">
                {CREATE_ACTIONS.map((action) => (
                  <CommandItem
                    key={action.id}
                    value={`new ${action.title}`}
                    keywords={[action.description]}
                    onSelect={() => {
                      setPaletteOpen(false)
                      navigate(createTarget(action))
                    }}
                  >
                    <action.icon />
                    New {action.title.toLowerCase()}
                    {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}
          <CommandGroup heading="Go to">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <CommandItem
                key={item.id}
                value={item.title}
                keywords={item.keywords}
                onSelect={() => go(item.to)}
              >
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Help">
            <CommandItem
              value="Help & keyboard shortcuts"
              keywords={["keys", "hotkeys", "tips"]}
              onSelect={() => {
                setPaletteOpen(false)
                setHelpOpen(true)
              }}
            >
              <CircleHelp />
              Help &amp; keyboard shortcuts
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
