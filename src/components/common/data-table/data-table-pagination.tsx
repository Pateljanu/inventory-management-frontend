import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { formatCount } from "@/lib/format"
import { PAGE_SIZES, type PageSize } from "@/lib/list-search"
import { cn } from "@/lib/utils"
import { pageWindow } from "@/lib/pagination"

type Props = {
  page: number
  pageSize: PageSize
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  className?: string
}

/** Numbered pages (not infinite scroll): records stay findable and Back keeps the position. */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)

  return (
    <nav
      aria-label="Pages"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums" aria-live="polite">
          {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
        </span>
        <label className="hidden items-center gap-2 sm:flex">
          Rows
          <NativeSelect
            size="sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <NativeSelectOption key={size} value={size}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-9 md:h-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft /> <span className="md:hidden">Previous</span>
        </Button>
        <span className="px-2 tabular-nums md:hidden">
          Page {page} of {pageCount}
        </span>
        <div className="hidden items-center gap-1 md:flex">
          {pageWindow(page, pageCount).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "outline" : "ghost"}
                size="sm"
                className={cn("min-w-8 tabular-nums", p === page && "font-semibold text-foreground")}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            )
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 md:h-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <span className="md:hidden">Next</span> <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
