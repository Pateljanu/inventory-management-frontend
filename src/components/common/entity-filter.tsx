import { EntityCombobox } from "@/components/common/form/entity-combobox"
import { ENTITY_LABELS, useEntityOption, type EntityKind } from "@/features/lookups/entity"

/** A supplier / buyer / material picker used as a list filter; the value is an id in the URL. */
export function EntityFilter({
  kind,
  value,
  onChange,
  allLabel,
  label,
}: {
  kind: EntityKind
  value: string | undefined
  onChange: (id: string | undefined) => void
  allLabel: string
  /** Accessible name when the filter means something narrower than the kind ("Stock from"). */
  label?: string
}) {
  const selected = useEntityOption(kind, value)
  const { noun } = ENTITY_LABELS[kind]
  return (
    <EntityCombobox
      value={selected}
      onChange={(o) => onChange(o?._id)}
      kind={kind}
      placeholder={allLabel}
      noun={noun}
      aria-label={label ?? ENTITY_LABELS[kind].label}
      className={value ? "border-primary bg-accent md:w-56" : "md:w-56"}
    />
  )
}
