import { Fragment } from "react"
import { Ellipsis, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type RowAction = {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  destructive?: boolean
  /** Draw a separator above this item. */
  separated?: boolean
}

/** The trailing "⋯" menu on table rows and phone cards. Renders nothing when empty. */
export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  if (!actions.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground pointer-coarse:size-11"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {actions.map((action) => (
          <Fragment key={action.label}>
            {action.separated ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={action.destructive ? "destructive" : "default"}
              onClick={action.onSelect}
              className="pointer-coarse:h-11"
            >
              {action.icon ? <action.icon /> : null}
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
