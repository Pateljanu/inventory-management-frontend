import type { ReactElement } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { CircleHelp, LogOut, Monitor, Moon, Sun, SunMedium, Rabbit } from "lucide-react"
import { useShell } from "./shell-context"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { usePreferences, type Theme } from "@/components/providers/preferences-provider"
import { logout } from "@/features/auth/session"
import { ROLE_LABELS } from "@/lib/permissions"
import type { User } from "@/types/api"

type UserMenuProps = {
  user: User
  /** The element that opens the menu (sidebar row or header avatar). */
  trigger: ReactElement
  side?: "top" | "bottom" | "right"
  align?: "start" | "end"
}

/** Account menu: who is signed in, display preferences and log out. */
export function UserMenu({ user, trigger, side = "top", align = "start" }: UserMenuProps) {
  const prefs = usePreferences()
  const { setHelpOpen } = useShell()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout()
    queryClient.clear()
    navigate({ to: "/login" })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent side={side} align={align} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1 py-2">
            <span className="truncate text-sm font-medium text-foreground">{user.name || user.email}</span>
            {user.name ? <span className="truncate font-normal">{user.email}</span> : null}
            <Badge variant="outline" className="mt-1">
              {ROLE_LABELS[user.role]}
            </Badge>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={prefs.theme} onValueChange={(v) => prefs.setTheme(v as Theme)}>
            <DropdownMenuRadioItem value="light">
              <Sun /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> Same as device
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuCheckboxItem
            checked={prefs.sunlight}
            onCheckedChange={(on) => prefs.setSunlight(Boolean(on))}
            disabled={prefs.resolvedTheme === "dark"}
          >
            <SunMedium /> Sunlight mode
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={prefs.reduceMotion}
            onCheckedChange={(on) => prefs.setReduceMotion(Boolean(on))}
          >
            <Rabbit /> Reduce animations
          </DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setHelpOpen(true)}>
          <CircleHelp /> Help &amp; shortcuts
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
