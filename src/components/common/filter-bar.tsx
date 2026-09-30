import { useEffect, useRef, useState, type ReactNode } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Field, FieldLabel } from "@/components/ui/field"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useIsMobile } from "@/hooks/use-mobile"
import { DEBOUNCE_SEARCH } from "@/lib/timing"
import { cn } from "@/lib/utils"

export type FilterOption = { value: string; label: string }

export type SelectFilter = {
  id: string
  label: string
  /** Current value, undefined = "All". */
  value: string | undefined
  options: FilterOption[]
  /** Label of the "no filter" choice, e.g. "All types". */
  allLabel: string
  onChange: (value: string | undefined) => void
}

type FilterBarProps = {
  search?: { value: string | undefined; onChange: (value: string | undefined) => void; placeholder: string }
  filters?: SelectFilter[]
  onClearAll?: () => void
  /** Extra controls in the row (date range, supplier picker). They manage their own values. */
  children?: ReactNode
  /** Chips for the extra controls' active values ("Supplier: Shree Ganesh Metals"). */
  chips?: FilterChip[]
}

export type FilterChip = { id: string; label: string; onRemove: () => void }

const ALL = "__all__"

/** Search box: types freely, applies after a 300 ms pause; "/" focuses it from anywhere. */
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
  placeholder: string
}) {
  const [text, setText] = useState(value ?? "")
  const debounced = useDebouncedValue(text, DEBOUNCE_SEARCH)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastSent = useRef(value ?? "")

  // Follow outside changes (Clear all, Back button) without fighting the user's typing.
  useEffect(() => {
    if ((value ?? "") !== lastSent.current) {
      lastSent.current = value ?? ""
      setText(value ?? "")
    }
  }, [value])

  useEffect(() => {
    const next = debounced.trim()
    if (next !== lastSent.current) {
      lastSent.current = next
      onChange(next || undefined)
    }
  }, [debounced, onChange])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== "/" || target.closest("input,textarea,select,[contenteditable=true]")) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <InputGroup className="h-11 w-full md:h-9 md:w-72">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && text) {
            e.preventDefault()
            setText("")
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="text-base md:text-sm"
      />
      <InputGroupAddon align="inline-end">
        {text ? (
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setText("")}>
            <X />
          </InputGroupButton>
        ) : (
          <Kbd className="hidden md:inline-flex">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

function FilterSelect({ filter }: { filter: SelectFilter }) {
  const items = [{ value: ALL, label: filter.allLabel }, ...filter.options]
  const active = filter.value !== undefined
  return (
    <Select
      items={items}
      value={filter.value ?? ALL}
      onValueChange={(v) => filter.onChange(v === ALL || v == null ? undefined : String(v))}
    >
      <SelectTrigger
        aria-label={filter.label}
        className={cn("h-9 min-w-36", active && "border-primary bg-accent text-accent-foreground")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {items.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * One toolbar for every list. Desktop: filters apply instantly. Phones: search stays visible and
 * a "Filters (n)" button opens a sheet where choices apply together with "Show results".
 */
export function FilterBar({ search, filters = [], onClearAll, children, chips = [] }: FilterBarProps) {
  const isMobile = useIsMobile()
  const activeFilters = filters.filter((f) => f.value !== undefined)
  const anyActive = activeFilters.length > 0 || chips.length > 0 || Boolean(search?.value)
  const allChips: FilterChip[] = [
    ...chips,
    ...activeFilters.map((f) => ({
      id: f.id,
      label: `${f.label}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`,
      onRemove: () => f.onChange(undefined),
    })),
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {search ? <SearchBox {...search} /> : null}
        {isMobile ? (
          filters.length ? (
            <MobileFilters filters={filters} activeCount={activeFilters.length} />
          ) : null
        ) : (
          filters.map((f) => <FilterSelect key={f.id} filter={f} />)
        )}
        {isMobile && children ? (
          <MobileFilterControls activeCount={chips.length}>{children}</MobileFilterControls>
        ) : (
          children
        )}
        {anyActive && onClearAll && !isMobile ? (
          <Button variant="link" size="sm" onClick={onClearAll}>
            Clear all
          </Button>
        ) : null}
      </div>
      {allChips.length ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Active filters">
          {allChips.map((c) => (
            <li key={c.id}>
              <Badge variant="outline" className="h-7 max-w-72 gap-1 rounded-md pr-1 text-sm font-normal">
                <span className="truncate">{c.label}</span>
                <button
                  type="button"
                  className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                  aria-label={`Remove filter ${c.label}`}
                  onClick={c.onRemove}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
          {isMobile && onClearAll ? (
            <li>
              <Button variant="link" size="sm" className="h-7" onClick={onClearAll}>
                Clear all
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

/** Phones: custom filter controls (date range, pickers) move into a bottom sheet and apply as chosen. */
function MobileFilterControls({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Filters{activeCount ? ` (${activeCount})` : ""}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 [&>*]:h-11 [&>*]:w-full">{children}</div>
          <SheetFooter>
            <Button className="h-12" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function MobileFilters({ filters, activeCount }: { filters: SelectFilter[]; activeCount: number }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string | undefined>>({})

  const openSheet = () => {
    setDraft(Object.fromEntries(filters.map((f) => [f.id, f.value])))
    setOpen(true)
  }

  const apply = () => {
    for (const f of filters) if (draft[f.id] !== f.value) f.onChange(draft[f.id])
    setOpen(false)
  }

  return (
    <>
      <Button variant="outline" className="h-11" onClick={openSheet}>
        <SlidersHorizontal /> Filters{activeCount ? ` (${activeCount})` : ""}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4">
            {filters.map((f) => (
              <Field key={f.id}>
                <FieldLabel htmlFor={`filter-${f.id}`}>{f.label}</FieldLabel>
                <NativeSelect
                  id={`filter-${f.id}`}
                  className="w-full [&_select]:h-11 [&_select]:text-base"
                  value={draft[f.id] ?? ALL}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [f.id]: e.target.value === ALL ? undefined : e.target.value }))
                  }
                >
                  <NativeSelectOption value={ALL}>{f.allLabel}</NativeSelectOption>
                  {f.options.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            ))}
          </div>
          <SheetFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setDraft(Object.fromEntries(filters.map((f) => [f.id, undefined])))}
            >
              Reset
            </Button>
            <Button className="h-12" onClick={apply}>
              Show results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
