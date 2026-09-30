import { useId, useState, type FormEvent, type RefObject } from "react"
import { CircleAlert } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { useSaveCompany } from "@/features/companies/api"
import { COMPANY_TYPES } from "@/features/companies/company-types"
import { useSaveMaterial } from "@/features/materials/api"
import { isApiError } from "@/lib/api-client"
import { errorMessage } from "@/lib/errors"
import { notify } from "@/lib/notify"
import type { CompanyType } from "@/types/api"
import type { EntityOption } from "./api"
import type { EntityKind } from "./entity"

/** Company roles offered per picker: a supplier picker creates suppliers (or both), and so on. */
const TYPE_CHOICES: Record<Exclude<EntityKind, "material">, CompanyType[]> = {
  supplier: ["PURCHASE", "BOTH"],
  buyer: ["SALE", "BOTH"],
  company: ["PURCHASE", "SALE", "BOTH"],
}

const NOUN: Record<EntityKind, string> = {
  supplier: "supplier",
  buyer: "buyer",
  company: "company",
  material: "material",
}

type QuickCreateDialogProps = {
  kind: EntityKind
  open: boolean
  /** What the user had typed in the picker. */
  initialName: string
  onClose: () => void
  onCreated: (option: EntityOption) => void
  /** Where focus goes when the dialog closes (the picker it was opened from). */
  returnFocus?: RefObject<HTMLElement | null>
}

/**
 * "+ Add" from inside a picker (Alt+C, as in Tally): creates the missing company or material
 * with only what a form needs right now, then hands it back to the picker. Details such as GST
 * number or opening stock can be filled in later on the record's own page.
 */
export function QuickCreateDialog({
  kind,
  open,
  initialName,
  onClose,
  onCreated,
  returnFocus,
}: QuickCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" finalFocus={returnFocus}>
        {/* Remounted per open so the typed name is picked up each time. */}
        {open ? (
          <QuickCreateForm kind={kind} initialName={initialName} onClose={onClose} onCreated={onCreated} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function QuickCreateForm({ kind, initialName, onClose, onCreated }: Omit<QuickCreateDialogProps, "open">) {
  const id = useId()
  const isMaterial = kind === "material"
  const choices = isMaterial ? [] : TYPE_CHOICES[kind]
  const [name, setName] = useState(initialName.trim())
  const [type, setType] = useState<CompanyType | "">(choices.length === 2 ? choices[0] : "")
  const [nameError, setNameError] = useState<string | null>(null)
  const [typeError, setTypeError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const saveCompany = useSaveCompany()
  const saveMaterial = useSaveMaterial()
  const pending = saveCompany.isPending || saveMaterial.isPending
  const noun = NOUN[kind]

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation() // never submit the form behind the dialog
    if (pending) return
    const trimmed = name.trim()
    const badName =
      trimmed.length < 2
        ? `Enter the ${noun} name (at least 2 letters)`
        : trimmed.length > 120
          ? "Keep the name under 120 characters"
          : null
    const badType = !isMaterial && !type ? "Choose what you do with this company" : null
    setNameError(badName)
    setTypeError(badType)
    setFormError(null)
    if (badName || badType) return

    try {
      const saved = isMaterial
        ? await saveMaterial.mutateAsync({ input: { name: trimmed } })
        : await saveCompany.mutateAsync({ input: { name: trimmed, type: type as CompanyType } })
      notify.success(isMaterial ? "Material added" : "Company added", { description: saved.name })
      onCreated({ _id: saved._id, name: saved.name })
    } catch (error) {
      if (isApiError(error) && error.code === "DUPLICATE_VALUE") {
        setNameError(
          isMaterial
            ? "A material with this name already exists. Search for it in the list. If it isn't there, it is inactive: reactivate it on the Materials page."
            : `A company with this name already exists. Search for it in the list. If it isn't there, it is inactive or not set up as a ${noun}: change it on its page.`
        )
      } else if (isApiError(error) && error.code === "VALIDATION_ERROR" && error.issues.length) {
        setNameError(error.issues[0].message)
      } else {
        setFormError(errorMessage(error))
      }
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isMaterial ? "New material" : `New ${noun}`}</DialogTitle>
        <DialogDescription>
          {isMaterial
            ? "Opening stock and notes can be added later on the material's page."
            : "GST number, contact and address can be added later on the company's page."}
        </DialogDescription>
      </DialogHeader>

      {formError ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <Field data-invalid={Boolean(nameError)} className="gap-2">
        <FieldLabel htmlFor={`${id}-name`}>{isMaterial ? "Material name" : "Company name"}</FieldLabel>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          autoComplete={isMaterial ? "off" : "organization"}
          autoFocus
          className="h-11 text-base md:h-9 md:text-sm"
        />
        {nameError ? (
          <p id={`${id}-name-error`} className="flex items-start gap-1.5 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {nameError}
          </p>
        ) : null}
      </Field>

      {!isMaterial ? (
        <FieldSet data-invalid={Boolean(typeError)} className="gap-2">
          <FieldLegend variant="label">What do you do with them?</FieldLegend>
          <RadioGroup
            value={type || null}
            onValueChange={(v) => setType(v as CompanyType)}
            aria-invalid={Boolean(typeError)}
            aria-describedby={typeError ? `${id}-type-error` : undefined}
          >
            {choices.map((value) => (
              <Field key={value} orientation="horizontal" className="min-h-8 pointer-coarse:min-h-11">
                <RadioGroupItem value={value} id={`${id}-${value}`} />
                <FieldLabel htmlFor={`${id}-${value}`} className="flex-col items-start gap-0 font-normal">
                  <span className="font-medium">{COMPANY_TYPES[value].label}</span>
                  <span className="text-xs text-muted-foreground">{COMPANY_TYPES[value].description}</span>
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          {typeError ? (
            <p id={`${id}-type-error`} className="flex items-start gap-1.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {typeError}
            </p>
          ) : null}
        </FieldSet>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="h-11 min-w-32 sm:h-9" aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            `Add ${noun}`
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
