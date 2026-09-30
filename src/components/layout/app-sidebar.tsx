import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, CircleHelp } from "lucide-react"
import { useShell } from "./shell-context"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogoMark } from "@/components/common/logo"
import { NAV_GROUPS } from "./nav"
import { UserMenu } from "./user-menu"
import { initials } from "@/lib/initials"
import { useIsActive } from "./use-nav-active"
import { useSession } from "@/features/auth/session"
import { openOrdersCountQuery } from "@/features/sales-orders/api"
import { ROLE_LABELS } from "@/lib/permissions"
import { formatCount } from "@/lib/format"

export function AppSidebar() {
  const { user } = useSession()
  const isActive = useIsActive()
  const { isMobile, setOpenMobile } = useSidebar()
  const openOrders = useQuery(openOrdersCountQuery())
  const { setHelpOpen } = useShell()

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" onClick={closeOnMobile} />} tooltip="Metalix">
              <LogoMark />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Metalix</span>
                <span className="truncate text-xs text-muted-foreground">Scrap management</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.to)
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        className="relative pointer-coarse:h-11 data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:left-0 data-active:before:w-0.5 data-active:before:rounded-full data-active:before:bg-primary"
                        render={
                          <Link
                            to={item.to}
                            aria-current={active ? "page" : undefined}
                            onClick={closeOnMobile}
                          />
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.id === "sales-orders" && openOrders.data ? (
                        <SidebarMenuBadge aria-label={`${openOrders.data} open orders`}>
                          {formatCount(openOrders.data)}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {/* Same place on every page (WCAG 3.2.6 consistent help). */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help & shortcuts"
              className="pointer-coarse:h-11"
              onClick={() => {
                closeOnMobile()
                setHelpOpen(true)
              }}
            >
              <CircleHelp />
              <span>Help &amp; shortcuts</span>
              <kbd className="ml-auto font-sans text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                ?
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu
                user={user}
                side={isMobile ? "top" : "right"}
                align="end"
                trigger={
                  <SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {initials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">{user.name || user.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                }
              />
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
