import { CircleX, CloudOff, Info, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { minus } from "@/lib/decimal"
import { formatDate, formatTons } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  assessLimits,
  limitLabel,
  limitReason,
  overLimitMessage,
  type LimitLevel,
  type LimitNames,
  type LimitRow,
} from "./limits"
import type { SaleCapacity, SaleSource } from "@/types/api"

type DeliveryLimitsPanelProps = {
  capacity: SaleCapacity | undefined
  /** No order chosen yet. */
  idle: boolean
  loading: boolean
  /** Newer limits are loading; the numbers shown may be about to change. */
  updating: boolean
  error: unknown
  onRetry: () => void
  tons: string
  names: LimitNames
  /** The chosen supplier's stock of this material, when one is chosen. */
  pool?: SaleSource
  onUseMax: (tons: string) => void
  className?: string
}

const BAR: Record<LimitLevel, string> = {
  empty: "bg-primary",
  ok: "bg-primary",
  near: "bg-warning",
  full: "bg-primary",
  over: "bg-destructive",
}

/**
 * The three numbers that cap a delivery, shown before saving: what is left on the order, the
 * material in the yard, and the chosen supplier's stock. Names the tightest one, previews what
 * is left after this delivery, and offers the maximum in one tap.
 */
export function DeliveryLimitsPanel({
  capacity,
  idle,
  loading,
  updating,
  error,
  onRetry,
  tons,
  names,
  pool,
  onUseMax,
  className,
}: DeliveryLimitsPanelProps) {
  return (
    <section
      aria-labelledby="delivery-limits-title"
      aria-busy={loading || updating}
      className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 id="delivery-limits-title" className="text-sm font-semibold">
          Delivery limits
        </h3>
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="About delivery limits">
                <Info />
              </Button>
            }
          />
          <PopoverContent className="w-72 text-sm">
            A delivery can&apos;t be more than what is left on the order, the material in the yard, or the
            stock bought from the chosen supplier. For a past date, stock already used by later deliveries is
            not counted.
          </PopoverContent>
        </Popover>
      </header>

      {idle ? (
        <p className="text-sm text-muted-foreground">Choose an order to see how much you can deliver.</p>
      ) : error && !capacity ? (
        <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground" role="status">
          <CloudOff className="size-5" aria-hidden />
          <p>Couldn&apos;t check limits right now. We&apos;ll still check when you save.</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : loading || !capacity ? (
        <div className="flex flex-col gap-3" role="status">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
          <span className="text-xs text-muted-foreground">Checking limits…</span>
        </div>
      ) : (
        <>
          <Limits capacity={capacity} tons={tons} names={names} onUseMax={onUseMax} updating={updating} />
          {pool ? <SupplierStock pool={pool} asOf={capacity.saleDate} updating={updating} /> : null}
        </>
      )}
    </section>
  )
}

/**
 * Where the chosen supplier's stock stands on the delivery date: bought, already delivered,
 * held back for later deliveries, free now, and when it was bought.
 */
function SupplierStock({ pool, asOf, updating }: { pool: SaleSource; asOf: string; updating: boolean }) {
  // Headroom can be below bought − used: later-dated deliveries already count on some of it.
  const held = minus(minus(pool.purchasedTons, pool.usedTons), pool.availableTons)
  const rows: [string, string][] = [
    ["Bought", formatTons(pool.purchasedTons, { unit: true })],
    ["Delivered from it", formatTons(pool.usedTons, { unit: true })],
    ...(held.gt(0)
      ? [["Held for later deliveries", formatTons(held.toFixed(3), { unit: true })] as [string, string]]
      : []),
    ["Free now", formatTons(pool.availableTons, { unit: true })],
  ]
  const dates =
    pool.firstPurchaseDate === null
      ? "Never bought this material from them."
      : !pool.lastPurchaseDate
        ? `First bought on ${formatDate(pool.firstPurchaseDate)}, after this date.`
        : pool.firstPurchaseDate === pool.lastPurchaseDate
          ? `Bought on ${formatDate(pool.lastPurchaseDate)}.`
          : `Last bought on ${formatDate(pool.lastPurchaseDate)} · first on ${formatDate(pool.firstPurchaseDate)}.`

  return (
    <div className={cn("border-t pt-3 transition-opacity", updating && "opacity-70")}>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {pool.name} on {formatDate(asOf)}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="truncate text-muted-foreground">{label}</dt>
            <dd className={cn("text-right tabular-nums", label === "Free now" && "font-semibold")}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-xs text-muted-foreground">{dates}</p>
    </div>
  )
}

function Limits({
  capacity,
  tons,
  names,
  onUseMax,
  updating,
}: {
  capacity: SaleCapacity
  tons: string
  names: LimitNames
  onUseMax: (tons: string) => void
  updating: boolean
}) {
  const a = assessLimits(capacity, tons)
  const binding = a.rows.find((r) => r.binding)!
  const canDeliver = capacity.poOpen && Number(a.max) > 0

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", updating && "opacity-70")}>
      <ul className="flex flex-col gap-2.5">
        {a.rows.map((row) => (
          <LimitMeter
            key={row.kind}
            row={row}
            label={limitLabel(row.kind, names)}
            typed={a.level !== "empty"}
          />
        ))}
      </ul>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "rounded-lg px-3 py-2.5 text-sm",
          !capacity.poOpen || a.level === "over"
            ? "bg-destructive/10 text-destructive"
            : a.level === "near"
              ? "bg-warning/15 text-warning-foreground dark:text-warning"
              : "bg-muted/60"
        )}
      >
        {!capacity.poOpen ? (
          <p className="flex gap-2">
            <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
            {names.poNumber} is cancelled. Deliveries can&apos;t be recorded against it.
          </p>
        ) : a.level === "over" ? (
          <p className="flex gap-2">
            <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
            {overLimitMessage(binding.kind, a.max, names)}
          </p>
        ) : (
          <>
            {canDeliver ? (
              <>
                <p>
                  You can deliver up to{" "}
                  <strong className="tabular-nums">{formatTons(a.max, { unit: true })}</strong>
                </p>
                <p className="text-xs text-muted-foreground">Limited by {limitReason(binding.kind, names)}</p>
              </>
            ) : (
              // Nothing left: say which limit and what to do ("PO-0142 is fully delivered. Choose another order.").
              <p className="font-medium">{overLimitMessage(binding.kind, a.max, names)}</p>
            )}
            {a.level === "full" ? (
              <p className="mt-1 text-xs text-muted-foreground">This delivery uses all of it.</p>
            ) : null}
            {a.level === "near" && a.spare ? (
              <p className="mt-1 flex items-center gap-1.5 font-medium">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                Close to the limit: {formatTons(a.spare, { unit: true })} to spare
              </p>
            ) : null}
          </>
        )}
        {capacity.availableSourceStockTons === null && capacity.poOpen ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Choose where the stock comes from to see its limit.
          </p>
        ) : null}
      </div>

      {canDeliver ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onUseMax(a.max)}
        >
          Use max ({formatTons(a.max, { unit: true })})
        </Button>
      ) : null}

      {a.level === "ok" || a.level === "near" || a.level === "full" ? (
        <div className="border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">After this delivery</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            {a.rows.map((row) => (
              <div key={row.kind} className="contents">
                <dt className="truncate text-muted-foreground">{afterLabel(row, names)}</dt>
                <dd className="text-right tabular-nums">{formatTons(row.after, { unit: true })}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function afterLabel(row: LimitRow, names: LimitNames) {
  if (row.kind === "PO") return `${names.poNumber} left`
  if (row.kind === "STOCK") return `Yard (${names.material})`
  return names.source ?? "Supplier"
}

function LimitMeter({ row, label, typed }: { row: LimitRow; label: string; typed: boolean }) {
  // Only the tightest limit turns amber; any limit that is exceeded turns red.
  const level: LimitLevel = row.binding ? row.level : row.level === "over" ? "over" : "ok"
  return (
    <li
      className={cn(
        "flex flex-col gap-1 rounded-lg px-2.5 py-2",
        row.binding ? "bg-accent/40 ring-[1.5px] ring-primary/60" : "ring-0"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {row.binding ? (
          <span className="shrink-0 text-[11px] font-medium text-primary">Tightest limit</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "min-w-20 text-base font-semibold tabular-nums",
            level === "over" && "text-destructive",
            level === "near" && "text-warning-foreground dark:text-warning"
          )}
        >
          {formatTons(row.value, { unit: true })}
        </span>
        <div
          role="meter"
          aria-label={`${label}: typed tons use ${Math.round(row.fill)}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(row.fill)}
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-(--duration-base)", BAR[level])}
            style={{ width: `${typed ? row.fill : 0}%` }}
          />
        </div>
        {level === "near" ? <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden /> : null}
        {level === "over" ? <CircleX className="size-4 shrink-0 text-destructive" aria-hidden /> : null}
      </div>
    </li>
  )
}
