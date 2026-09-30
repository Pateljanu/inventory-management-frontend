import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefCallback,
} from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import type { EntityOption } from "@/features/lookups/api"
import { entityOptionsQuery, type EntityKind } from "@/features/lookups/entity"
import { QuickCreateDialog } from "@/features/lookups/quick-create-dialog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { DEBOUNCE_SEARCH } from "@/lib/timing"
import { cn } from "@/lib/utils"

type EntityComboboxProps = {
  id?: string
  value: EntityOption | null
  onChange: (value: EntityOption | null) => void
  onBlur?: () => void
  /** Searches active suppliers, buyers or materials on the server... */
  kind?: EntityKind
  /** ...or picks from a fixed list (e.g. suppliers that hold stock), filtered locally. */
  options?: EntityOption[]
  optionsLoading?: boolean
  placeholder: string
  /** Word for the empty message: "No suppliers match". */
  noun: string
  /** Extra text at the right of an option (e.g. "9.200 t"); defaults to the option's `meta`. */
  renderMeta?: (option: EntityOption) => ReactNode
  /** A small tag inside the box, e.g. "Last used". */
  tag?: ReactNode
  /** Offer "+ Add '<typed text>'" (and Alt+C) to create a missing company or material. */
  allowCreate?: boolean
  /** A callback ref, such as React Hook Form's `field.ref` (focuses the box on errors). */
  inputRef?: RefCallback<HTMLInputElement>
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  "aria-label"?: string
}

// Module-level so their identity never changes: Base UI re-syncs its store whenever these do.
const labelOf = (o: EntityOption) => o.name
const sameEntity = (a: EntityOption, b: EntityOption) => a._id === b._id

/** The "+ Add" row travels in the list like any option, so arrow keys and Enter reach it. */
const CREATE_ID = "__create__"

/**
 * Type-to-search picker for companies and materials. Searches on the server (debounced
 * 300 ms), keeps the chosen record visible while new results load, and never lists
 * inactive records.
 */
export function EntityCombobox({
  id,
  value,
  onChange,
  onBlur,
  kind = "material",
  options,
  optionsLoading,
  placeholder,
  noun,
  renderMeta,
  tag,
  allowCreate = false,
  inputRef,
  className,
  ...aria
}: EntityComboboxProps) {
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const q = useDebouncedValue(text.trim(), DEBOUNCE_SEARCH)
  const remote = useQuery({ ...entityOptionsQuery(kind, q), enabled: open && !options })
  const canCreate = allowCreate && !options
  // Our own handle on the input (focus comes back here after "+ Add"), shared with the caller's ref.
  const ownInput = useRef<HTMLInputElement | null>(null)
  const setInput = useCallback(
    (el: HTMLInputElement | null) => {
      ownInput.current = el
      inputRef?.(el)
    },
    [inputRef]
  )

  const list = useMemo(() => {
    if (!options) return remote.data ?? []
    const needle = q.toLowerCase()
    // The detail line counts too, so an order can be found by its buyer's name.
    return needle
      ? options.filter((o) => `${o.name} ${o.meta ?? ""}`.toLowerCase().includes(needle))
      : options
  }, [options, remote.data, q])

  // The selected record stays in the list so its label survives a new search.
  const items = useMemo(() => {
    const withValue = value && !list.some((o) => o._id === value._id) ? [value, ...list] : list
    return canCreate ? [...withValue, { _id: CREATE_ID, name: q }] : withValue
  }, [list, value, canCreate, q])

  const searching = options ? Boolean(optionsLoading) : remote.isFetching && !remote.data
  const loadError = options ? null : remote.error
  const noMatches = !searching && list.length === 0

  const startCreate = (name: string) => {
    setOpen(false)
    setText("")
    setCreating(name)
  }

  return (
    <>
      <Combobox
        items={items}
        value={value}
        filter={null}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setText("")
            onBlur?.()
          }
        }}
        itemToStringLabel={labelOf}
        isItemEqualToValue={sameEntity}
        onValueChange={(next) => {
          const picked = (next as EntityOption | null) ?? null
          if (picked?._id === CREATE_ID) return startCreate(picked.name)
          onChange(picked)
          setText("")
        }}
        onInputValueChange={(next, details) => {
          if (details.reason !== "item-press") setText(next)
        }}
      >
        <ComboboxInput
          id={id}
          ref={setInput}
          placeholder={placeholder}
          showClear={Boolean(value)}
          className={cn(
            "h-11 w-full md:h-9 [&_input]:text-base md:[&_input]:text-sm",
            aria["aria-invalid"] && "border-destructive ring-3 ring-destructive/20",
            className
          )}
          autoComplete="off"
          aria-keyshortcuts={canCreate ? "Alt+C" : undefined}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            // Alt+C, as in Tally: create the company or material that isn't in the list yet.
            if (canCreate && event.altKey && event.code === "KeyC") {
              event.preventDefault()
              startCreate(text.trim())
            }
          }}
          {...aria}
        >
          {tag}
        </ComboboxInput>
        <ComboboxContent>
          {searching ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground" role="status">
              <Spinner /> Searching…
            </div>
          ) : null}
          {loadError ? (
            <div className="px-3 py-2 text-sm text-destructive" role="alert">
              Couldn&apos;t load {noun}. Close and try again.
            </div>
          ) : null}
          {canCreate && noMatches ? (
            <div className="px-3 pt-2 text-sm text-muted-foreground">
              No {noun} match{q ? ` "${q}"` : ""}.
            </div>
          ) : null}
          <ComboboxEmpty>{searching ? null : `No ${noun} match${q ? ` "${q}"` : ""}.`}</ComboboxEmpty>
          <ComboboxList>
            {(option: EntityOption) =>
              option._id === CREATE_ID ? (
                <ComboboxItem
                  key={CREATE_ID}
                  value={option}
                  className="min-h-8 font-medium text-primary pointer-coarse:min-h-11"
                >
                  <Plus aria-hidden="true" />
                  <span className="flex-1 truncate">
                    {option.name ? `Add "${option.name}"` : `Add a new ${singular(noun)}`}
                  </span>
                  <Kbd className="hidden pointer-fine:inline-flex">Alt C</Kbd>
                </ComboboxItem>
              ) : (
                <ComboboxItem key={option._id} value={option} className="min-h-8 pointer-coarse:min-h-11">
                  <span className="flex-1 truncate">{option.name}</span>
                  {renderMeta || option.meta ? (
                    <span className="truncate text-xs text-muted-foreground tabular-nums">
                      {renderMeta ? renderMeta(option) : option.meta}
                    </span>
                  ) : null}
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {canCreate ? (
        <QuickCreateDialog
          kind={kind}
          open={creating !== null}
          initialName={creating ?? ""}
          returnFocus={ownInput}
          onClose={() => setCreating(null)}
          onCreated={(created) => {
            setCreating(null)
            onChange(created)
          }}
        />
      ) : null}
    </>
  )
}

/** "suppliers" → "supplier", "companies" → "company". */
const singular = (noun: string) => noun.replace(/ies$/, "y").replace(/s$/, "")
