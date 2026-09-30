import { Ban, Circle, CircleCheck, CircleOff, Clock3, Truck, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type Status = "PENDING" | "PARTIALLY_SUPPLIED" | "COMPLETED" | "CANCELLED" | "ACTIVE" | "INACTIVE"

/** Every status carries colour, icon and words, so colour is never the only signal. */
const STATUS: Record<Status, { label: string; icon: LucideIcon; className: string }> = {
  PENDING: {
    label: "Pending",
    icon: Clock3,
    className: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  },
  PARTIALLY_SUPPLIED: { label: "Partly delivered", icon: Truck, className: "bg-info/12 text-info" },
  COMPLETED: { label: "Completed", icon: CircleCheck, className: "bg-success/12 text-success" },
  CANCELLED: { label: "Cancelled", icon: Ban, className: "bg-muted text-muted-foreground" },
  ACTIVE: { label: "Active", icon: Circle, className: "bg-success/12 text-success [&_svg]:fill-current" },
  INACTIVE: { label: "Inactive", icon: CircleOff, className: "bg-muted text-muted-foreground" },
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS[status]
  return (
    <Badge
      className={cn("h-[22px] rounded-md border-transparent px-2 [&>svg]:size-3.5!", s.className, className)}
    >
      <s.icon aria-hidden="true" />
      {s.label}
    </Badge>
  )
}
