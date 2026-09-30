import { Fragment } from "react"
import { Link, useMatches, useNavigate } from "@tanstack/react-router"
import { ChevronDown, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Kbd } from "@/components/ui/kbd"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LogoMark } from "@/components/common/logo"
import { CREATE_ACTIONS, createTarget } from "./nav"
import { useShell } from "./shell-context"
import { UserMenu } from "./user-menu"
import { initials } from "@/lib/initials"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"

/**
 * Breadcrumb trail: section pages name themselves in `staticData.title`; record pages return
 * `{ crumb }` from their loader (e.g. the company's name).
 */
function useCrumbs() {
  const matches = useMatches()
  return matches
    .map((m) => {
      const loaded = (m.loaderData as { crumb?: string } | undefined)?.crumb
      return { id: m.id, title: loaded ?? m.staticData?.title, pathname: m.pathname }
    })
    .filter((c): c is { id: string; title: string; pathname: string } => Boolean(c.title))
}

export function SiteHeader() {
  const { user } = useSession()
  const { setPaletteOpen } = useShell()
  const navigate = useNavigate()
  const crumbs = useCrumbs()
  const pageTitle = crumbs.at(-1)?.title ?? "Metalix"
  const canWrite = can(user, "write")

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:rounded-t-xl lg:px-6">
      {/* Phone: logo, page title, search and account. No hamburger; the bottom bar navigates. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
        <LogoMark className="size-7" />
        <h2 className="truncate text-lg font-semibold">{pageTitle}</h2>
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger className="-ml-1" />} />
          <TooltipContent side="bottom">
            Toggle sidebar <Kbd>Ctrl B</Kbd>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, i) => (
              <Fragment key={crumb.id}>
                {i > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem className="min-w-0">
                  {i === crumbs.length - 1 ? (
                    <BreadcrumbPage className="truncate">{crumb.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link to={crumb.pathname} />}>{crumb.title}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <Button
        variant="outline"
        className="hidden h-9 w-56 justify-start gap-2 px-3 font-normal text-muted-foreground md:inline-flex lg:w-72"
        onClick={() => setPaletteOpen(true)}
      >
        <Search />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>Ctrl K</Kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:hidden"
        aria-label="Search or jump to"
        onClick={() => setPaletteOpen(true)}
      >
        <Search className="size-5" />
      </Button>

      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="hidden h-9 px-3 md:inline-flex" />}>
            <Plus /> New <ChevronDown className="opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {CREATE_ACTIONS.map((action, i) => (
              <Fragment key={action.id}>
                {i === 3 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem onClick={() => navigate(createTarget(action))}>
                  <action.icon />
                  {action.title}
                  {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {user ? (
        <UserMenu
          user={user}
          side="bottom"
          align="end"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full md:hidden"
              aria-label="Account"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(user)}
                </AvatarFallback>
              </Avatar>
            </Button>
          }
        />
      ) : null}
    </header>
  )
}
