import { useState } from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ErrorState } from "@/components/common/error-state"
import { plus, toBig } from "@/lib/decimal"
import { formatMoney, formatTons } from "@/lib/format"
import { bucketLabel } from "./buckets"
import type { Trend } from "@/types/api"

const config = {
  bought: { label: "Bought", color: "var(--chart-1)" },
  delivered: { label: "Delivered", color: "var(--chart-2)" },
} satisfies ChartConfig

const BUCKET_WORDS = { day: "per day", week: "per week", month: "per month" } as const

/**
 * Tons bought vs delivered over the period. Bought is a solid line and delivered a dashed one, so
 * the two stay apart without colour; a table view gives the exact figures (and the rupees).
 */
export function TrendChart({
  trend,
  loading,
  error,
  onRetry,
  className,
}: {
  trend: Trend | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  className?: string
}) {
  const [asTable, setAsTable] = useState(false)
  const points = trend?.points ?? []
  const data = points.map((p) => ({
    label: bucketLabel(p.start, p.end, trend!.bucket),
    // Numbers for drawing only; every figure a person reads comes from the decimal strings.
    bought: Number(p.purchasedTons),
    delivered: Number(p.deliveredTons),
  }))
  const total = (key: "purchasedTons" | "deliveredTons") =>
    points.reduce((sum, p) => plus(sum, p[key]), toBig(0)).toFixed(3)

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Bought vs delivered</CardTitle>
        <CardDescription>Tons {trend ? BUCKET_WORDS[trend.bucket] : ""}</CardDescription>
        {points.length > 1 ? (
          <CardAction>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAsTable((v) => !v)}>
              {asTable ? "View as chart" : "View as table"}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {error && !trend ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : loading || !trend ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <svg width="24" height="8" aria-hidden>
                  <line x1="0" y1="4" x2="24" y2="4" stroke="var(--chart-1)" strokeWidth="2.5" />
                </svg>
                Bought{" "}
                <strong className="tabular-nums">{formatTons(total("purchasedTons"), { unit: true })}</strong>
              </span>
              <span className="flex items-center gap-2">
                <svg width="24" height="8" aria-hidden>
                  <line
                    x1="0"
                    y1="4"
                    x2="24"
                    y2="4"
                    stroke="var(--chart-2)"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                  />
                </svg>
                Delivered{" "}
                <strong className="tabular-nums">{formatTons(total("deliveredTons"), { unit: true })}</strong>
              </span>
            </div>

            {points.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Choose a longer period to see how this changes over time.
              </p>
            ) : asTable ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Bought (t)</TableHead>
                      <TableHead className="text-right">Delivered (t)</TableHead>
                      <TableHead className="text-right">Bought (₹)</TableHead>
                      <TableHead className="text-right">Delivered (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {points.map((p, i) => (
                      <TableRow key={p.start}>
                        <TableCell className="whitespace-nowrap">{data[i].label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTons(p.purchasedTons)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatTons(p.deliveredTons)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(p.purchaseValue, { symbol: false })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(p.salesValue, { symbol: false })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <ChartContainer
                config={config}
                className="aspect-auto h-64 w-full"
                role="img"
                aria-label={`Line chart of tons bought and delivered ${BUCKET_WORDS[trend.bucket]}. Use "View as table" for the figures.`}
              >
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                  <YAxis
                    width={44}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(v: number) => String(v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <span className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">
                              {config[name as keyof typeof config].label}
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatTons(String(value), { unit: true })}
                            </span>
                          </span>
                        )}
                      />
                    }
                  />
                  <Line
                    dataKey="bought"
                    type="linear"
                    stroke="var(--color-bought)"
                    strokeWidth={2.5}
                    dot={data.length <= 16}
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="delivered"
                    type="linear"
                    stroke="var(--color-delivered)"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={data.length <= 16}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
