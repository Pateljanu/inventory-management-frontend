import { Link } from "@tanstack/react-router"
import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { percentOf } from "@/lib/decimal"
import { formatPercent, formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SalesPO } from "@/types/api"

/** Delivered share of the order: a bar plus "61%" (or "18.250 of 30.000 t · 61%"). */
export function OrderProgress({
  po,
  detailed,
  className,
}: {
  po: SalesPO
  detailed?: boolean
  className?: string
}) {
  const pct = Math.min(100, percentOf(po.soldQuantityTons, po.quantityTons))
  const label = detailed
    ? `${formatTons(po.soldQuantityTons)} of ${formatTons(po.quantityTons, { unit: true })} delivered · ${formatPercent(pct)}`
    : formatPercent(pct)
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Delivered"
        className={cn("h-2 flex-1 overflow-hidden rounded-full bg-muted", detailed ? "min-w-40" : "min-w-16")}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-(--duration-slow)",
            po.displayStatus === "COMPLETED"
              ? "bg-success"
              : po.displayStatus === "CANCELLED"
                ? "bg-muted-foreground/40"
                : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{label}</span>
    </div>
  )
}

/** The most frequent action on an open order: record a delivery against it. */
export function DeliverButton({
  po,
  size = "sm",
  className,
}: {
  po: SalesPO
  size?: "sm" | "default"
  className?: string
}) {
  return (
    <Button
      size={size}
      variant={size === "sm" ? "outline" : "default"}
      className={className}
      render={<Link to="/deliveries" search={{ create: true, poId: po._id }} />}
    >
      <Truck /> Deliver
    </Button>
  )
}
