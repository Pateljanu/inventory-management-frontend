import {
  columnVisibilityFeature,
  createColumnHelper,
  metaHelper,
  tableFeatures,
  type RowData,
} from "@tanstack/react-table"

/** Per-column presentation hints read by DataTable. */
export type AppColumnMeta = {
  /** Numbers are right-aligned ("end") with tabular figures. */
  align?: "start" | "end"
  /** Name shown in the column menu when the header is not plain text. */
  label?: string
  className?: string
  /** Fixed or minimum width, e.g. "w-28". */
  headerClassName?: string
}

/**
 * The only table features the app uses: column visibility and typed column meta. Paging,
 * filtering and sorting happen on the server and live in the URL, not in table state.
 */
export const appTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnMeta: metaHelper<AppColumnMeta>(),
})

export type AppTableFeatures = typeof appTableFeatures

export const createAppColumnHelper = <TData extends RowData>() =>
  createColumnHelper<AppTableFeatures, TData>()
