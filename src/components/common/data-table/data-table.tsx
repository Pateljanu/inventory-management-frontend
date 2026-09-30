import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react"
import {
  functionalUpdate,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
} from "@tanstack/react-table"
import { Columns3 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ErrorState } from "@/components/common/error-state"
import { DataTablePagination } from "./data-table-pagination"
import { appTableFeatures, type AppTableFeatures } from "./table-features"
import { useIsMobile } from "@/hooks/use-mobile"
import { useDelayedFlag } from "@/hooks/use-delayed-flag"
import type { PageSize } from "@/lib/list-search"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppColumnDef<TData extends RowData> = ColumnDef<AppTableFeatures, TData, any>

type DataTableProps<TData extends RowData> = {
  /** Stable id; column choices are remembered per table on this device. */
  tableId: string
  /** Columns hidden until the user shows them from the Columns menu. */
  defaultHidden?: string[]
  label: string
  columns: AppColumnDef<TData>[]
  data: TData[] | undefined
  getRowId: (row: TData) => string
  total: number | undefined
  page: number
  pageSize: PageSize
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  isPending: boolean
  /** True while newer data loads behind the rows already shown. */
  isRefreshing?: boolean
  error?: unknown
  onRetry?: () => void
  /** Whole-row click (the primary cell also holds a real link or button for keyboards). */
  onRowClick?: (row: TData) => void
  /** Phones (< 768 px) show one card per row instead of a table. */
  renderMobileCard: (row: TData) => ReactNode
  /** Shown when there are no rows at all. */
  empty: ReactNode
  highlightRowId?: string | null
  /** Content above the table (summary strip). */
  summary?: ReactNode
}

const EMPTY: never[] = []

function readVisibility(tableId: string, defaultHidden: string[] = []): ColumnVisibilityState {
  const defaults = Object.fromEntries(defaultHidden.map((id) => [id, false]))
  try {
    const saved = localStorage.getItem(`metalix.cols.${tableId}`)
    return saved ? JSON.parse(saved) : defaults
  } catch {
    return defaults
  }
}

/** Clicks on links, buttons and menus inside a row do their own thing. */
function isInteractive(event: MouseEvent) {
  return Boolean((event.target as HTMLElement).closest("a,button,input,select,textarea,[role=menuitem]"))
}

export function DataTable<TData extends RowData>({
  tableId,
  defaultHidden,
  label,
  columns,
  data,
  getRowId,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isPending,
  isRefreshing,
  error,
  onRetry,
  onRowClick,
  renderMobileCard,
  empty,
  highlightRowId,
  summary,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile()
  const showSkeleton = useDelayedFlag(isPending)
  const [columnVisibility, setColumnVisibility] = useState(() => readVisibility(tableId, defaultHidden))

  const onColumnVisibilityChange = useCallback(
    (updater: ColumnVisibilityState | ((old: ColumnVisibilityState) => ColumnVisibilityState)) => {
      setColumnVisibility((old) => {
        const next = functionalUpdate(updater, old)
        try {
          localStorage.setItem(`metalix.cols.${tableId}`, JSON.stringify(next))
        } catch {
          // Storage blocked: the choice lasts for this visit.
        }
        return next
      })
    },
    [tableId]
  )

  const table = useTable({
    features: appTableFeatures,
    columns,
    data: data ?? EMPTY,
    getRowId: (row: TData) => getRowId(row),
    state: { columnVisibility },
    onColumnVisibilityChange,
  })

  // Bring a just-saved row into view.
  const highlightRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (highlightRowId) highlightRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [highlightRowId, data])

  const rows = table.getRowModel().rows
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.columnDef.meta?.label)

  let body: ReactNode
  if (error && !data) {
    body = <ErrorState error={error} onRetry={onRetry} />
  } else if (isPending) {
    body = showSkeleton ? (
      <TableSkeleton rows={Math.min(pageSize, 8)} />
    ) : (
      <div className="h-64" aria-busy="true" />
    )
  } else if (rows.length === 0) {
    body = empty
  } else if (isMobile) {
    body = (
      <ul
        className={cn("flex flex-col gap-3 transition-opacity", isRefreshing && "opacity-60")}
        aria-label={label}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            ref={row.id === highlightRowId ? (el) => void (highlightRef.current = el) : undefined}
            className={cn("rounded-xl", row.id === highlightRowId && "row-saved")}
          >
            {renderMobileCard(row.original)}
          </li>
        ))}
      </ul>
    )
  } else {
    body = (
      <div className="relative overflow-hidden rounded-xl border">
        {isRefreshing ? (
          <div
            className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/15"
            role="progressbar"
          >
            <div className="h-full w-1/3 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
          </div>
        ) : null}
        <Table aria-label={label} aria-busy={isRefreshing || undefined}>
          <TableHeader className="sticky top-0 z-[1] bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-10 px-3 text-xs font-medium text-muted-foreground first:pl-4 last:pr-4",
                        meta?.align === "end" && "text-right",
                        meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn("transition-opacity", isRefreshing && "opacity-60")}>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                ref={row.id === highlightRowId ? (el) => void (highlightRef.current = el) : undefined}
                className={cn(
                  "h-10 duration-(--duration-fast) pointer-coarse:h-12",
                  onRowClick && "cursor-pointer",
                  row.id === highlightRowId && "row-saved"
                )}
                onClick={onRowClick ? (e) => !isInteractive(e) && onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-2 first:pl-4 last:pr-4",
                        meta?.align === "end" && "text-right tabular-nums",
                        meta?.className
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  const showFooter = !isPending && !(error && !data) && (total ?? 0) > 0

  return (
    <section className="flex flex-col gap-3" aria-label={label}>
      {summary || (hideable.length > 0 && !isMobile) ? (
        <div className="flex min-h-8 items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground tabular-nums">{summary}</div>
          {hideable.length > 0 && !isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
              >
                <Columns3 /> Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideable.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(on) => column.toggleVisibility(Boolean(on))}
                    >
                      {column.columnDef.meta?.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
      {body}
      {showFooter ? (
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total ?? 0}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </section>
  )
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}
