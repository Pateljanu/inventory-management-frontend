import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field"
import { FormSheet, FormSheetCancel, SaveKeyHint } from "@/components/common/form/form-sheet"
import { useOpenSession } from "@/hooks/use-open-session"
import { useFormDraft } from "@/hooks/use-form-draft"
import { DraftNotice } from "@/components/common/form/draft-notice"
import { FormField } from "@/components/common/form/form-field"
import { ErrorSummary } from "@/components/common/form/error-summary"
import { DateInput } from "@/components/common/form/date-input"
import { EntityCombobox } from "@/components/common/form/entity-combobox"
import { RateInput, TonsInput } from "@/components/common/form/tons-input"
import { ErrorState } from "@/components/common/error-state"
import { lastPurchaseQuery, purchaseQuery, useSavePurchase, type PurchaseInput } from "./api"
import type { EntityOption } from "@/features/lookups/api"
import { isApiError } from "@/lib/api-client"
import { applyServerErrors, collectErrors } from "@/lib/form-errors"
import { amountFrom, isPositive, toBig } from "@/lib/decimal"
import { businessToday, isDateOnly, toDateOnly } from "@/lib/dates"
import { formatDate, formatMoney, formatRate, formatTons } from "@/lib/format"
import { normalizeCode, readLastUsed, writeLastUsed } from "@/lib/last-used"
import { notify } from "@/lib/notify"
import { stockHistoryMessage } from "@/lib/stock-errors"
import type { Purchase, Saved } from "@/types/api"

const TONS = /^\d{1,12}(\.\d{1,3})?$/
const RATE = /^\d{1,12}(\.\d{1,2})?$/
const entity = z.object({ _id: z.string(), name: z.string() }).nullable()

const schema = z.object({
  purchaseDate: z.string().refine(isDateOnly, "Choose the purchase date"),
  supplier: entity.refine((v) => v !== null, "Choose a supplier"),
  material: entity.refine((v) => v !== null, "Choose a material"),
  quantityTons: z
    .string()
    .refine((v) => v !== "", "Enter the tons, like 12.450")
    .refine(
      (v) => v === "" || (TONS.test(v) && isPositive(v)),
      "Enter tons as a number above zero, like 12.450"
    ),
  ratePerTon: z
    .string()
    .refine((v) => v !== "", "Enter the rate per ton, like 34,500")
    .refine(
      (v) => v === "" || (RATE.test(v) && isPositive(v)),
      "Enter the rate as a number above zero, like 34,500"
    ),
  vehicleNumber: z.string().max(30, "Keep the vehicle number under 30 characters"),
  invoiceNumber: z.string().trim().max(80, "Keep the invoice number under 80 characters"),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
})

type Values = z.input<typeof schema>
const ORDER = [
  "purchaseDate",
  "supplier",
  "material",
  "quantityTons",
  "ratePerTon",
  "vehicleNumber",
  "invoiceNumber",
  "notes",
] as const

type LastUsed = { supplier?: EntityOption; material?: EntityOption }
const LAST_KEY = "purchase"

function fromPurchase(p: Purchase, { keepDate }: { keepDate: boolean }): Values {
  return {
    purchaseDate: keepDate ? (toDateOnly(p.purchaseDate) ?? businessToday()) : businessToday(),
    supplier: { _id: p.companyId._id, name: p.companyId.name },
    material: { _id: p.materialId._id, name: p.materialId.name },
    quantityTons: keepDate ? toBig(p.quantityTons).toString() : "",
    ratePerTon: toBig(p.ratePerTon).toString(),
    vehicleNumber: p.vehicleNumber ?? "",
    invoiceNumber: keepDate ? (p.invoiceNumber ?? "") : "",
    notes: keepDate ? (p.notes ?? "") : "",
  }
}

function blankValues(material?: EntityOption): Values {
  const last = readLastUsed<LastUsed>(LAST_KEY)
  return {
    purchaseDate: businessToday(),
    supplier: last?.supplier ?? null,
    material: material ?? last?.material ?? null,
    quantityTons: "",
    ratePerTon: "",
    vehicleNumber: "",
    invoiceNumber: "",
    notes: "",
  }
}

function toInput(v: Values): PurchaseInput {
  return {
    purchaseDate: v.purchaseDate,
    companyId: v.supplier!._id,
    materialId: v.material!._id,
    quantityTons: v.quantityTons,
    ratePerTon: v.ratePerTon,
    vehicleNumber: normalizeCode(v.vehicleNumber),
    invoiceNumber: v.invoiceNumber.trim(),
    notes: v.notes.trim(),
  }
}

type PurchaseSheetProps = {
  open: boolean
  /** Edit this purchase. */
  purchaseId?: string
  /** Create pre-filled from this purchase ("Repeat purchase"). */
  repeatId?: string
  /** Create with this material chosen (e.g. "+ Purchase" on a material that is short). */
  material?: EntityOption
  onClose: () => void
  onSaved: (purchase: Saved<Purchase>, opts: { another: boolean }) => void
}

export function PurchaseSheet({
  open,
  purchaseId,
  repeatId,
  material,
  onClose,
  onSaved,
}: PurchaseSheetProps) {
  const sourceId = purchaseId ?? repeatId
  const source = useQuery({ ...purchaseQuery(sourceId ?? ""), enabled: open && Boolean(sourceId) })
  const session = useOpenSession(open)

  if (sourceId && !source.data) {
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title={purchaseId ? "Edit purchase" : "New purchase"}
        isDirty={false}
        recordName="purchase"
        footer={null}
      >
        {source.error ? (
          <ErrorState error={source.error} onRetry={() => source.refetch()} />
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </FormSheet>
    )
  }

  return (
    <PurchaseForm
      key={`${purchaseId ?? "new"}-${repeatId ?? ""}-${material?._id ?? ""}-${session}`}
      open={open}
      editing={purchaseId ? source.data : undefined}
      initial={
        purchaseId && source.data
          ? fromPurchase(source.data, { keepDate: true })
          : repeatId && source.data
            ? fromPurchase(source.data, { keepDate: false })
            : blankValues(material)
      }
      draftContext={purchaseId || repeatId ? undefined : material ? `material:${material._id}` : "new"}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function PurchaseForm({
  open,
  editing,
  initial,
  draftContext,
  onClose,
  onSaved,
}: {
  open: boolean
  editing?: Purchase
  initial: Values
  /** Keep unsaved typing as a draft for this kind of new purchase; off for edits and repeats. */
  draftContext?: string
  onClose: () => void
  onSaved: PurchaseSheetProps["onSaved"]
}) {
  const isEdit = Boolean(editing)
  const save = useSavePurchase()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [lastUsed, setLastUsed] = useState(() => readLastUsed<LastUsed>(LAST_KEY))

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const { control, formState, setValue, getFieldState } = form
  const draft = useFormDraft(form, {
    name: "purchase",
    context: draftContext ?? "",
    enabled: Boolean(draftContext),
  })
  const [supplier, material, quantity, rate] = useWatch({
    control,
    name: ["supplier", "material", "quantityTons", "ratePerTon"],
  })

  // Smart default: the last rate paid to this supplier for this material.
  const last = useQuery({
    ...lastPurchaseQuery(supplier?._id ?? "", material?._id ?? ""),
    enabled: !isEdit && Boolean(supplier && material),
  })
  const lastRate = last.data && !isEdit ? last.data : null
  useEffect(() => {
    if (!lastRate || getFieldState("ratePerTon").isDirty) return
    setValue("ratePerTon", toBig(lastRate.ratePerTon).toString(), { shouldDirty: false })
  }, [lastRate, getFieldState, setValue])

  const amount = TONS.test(quantity) && RATE.test(rate) ? amountFrom(quantity, rate) : null

  const submit = async (values: Values, another: boolean) => {
    if (save.isPending) return
    setFormMessage(null)
    try {
      const saved = await save.mutateAsync({ id: editing?._id, input: toInput(values) })
      draft.clear()
      writeLastUsed<LastUsed>(LAST_KEY, { supplier: values.supplier!, material: values.material! })
      notify.success(isEdit ? "Purchase updated" : "Purchase saved", {
        description: `${formatTons(saved.quantityTons, { unit: true })} of ${values.material!.name} from ${values.supplier!.name} · ${formatMoney(saved.totalAmount)}`,
      })
      if (another) {
        // Next truck: keep date, supplier, material and the rate just used; clear the rest.
        form.reset({
          ...blankValues(),
          purchaseDate: values.purchaseDate,
          supplier: values.supplier,
          material: values.material,
          ratePerTon: values.ratePerTon,
        })
        setLastUsed({ supplier: values.supplier!, material: values.material! })
        window.setTimeout(() => form.setFocus("quantityTons"), 50)
      }
      onSaved(saved, { another })
    } catch (error) {
      const stock = stockHistoryMessage(error)
      if (stock) {
        form.setError("quantityTons", { type: "server", message: stock })
      } else if (isApiError(error) && error.code === "INVALID_PURCHASE_COMPANY") {
        form.setError("supplier", {
          type: "server",
          message: "This supplier is inactive or isn't a supplier. Choose another.",
        })
      } else if (isApiError(error) && error.code === "INVALID_MATERIAL") {
        form.setError("material", { type: "server", message: "This material is inactive. Choose another." })
      } else {
        const { formMessage } = applyServerErrors(error, form.setError, ORDER, {
          fieldMap: {
            companyId: "supplier",
            materialId: "material",
            normalizedInvoiceNumber: "invoiceNumber",
          },
          duplicateMessages: {
            invoiceNumber: "This supplier already has a purchase with this invoice number.",
          },
        })
        setFormMessage(formMessage)
      }
      setFocusKey((k) => k + 1)
    }
  }

  // "Save & add another" is told apart by the button that submitted the form (Ctrl+Enter = plain save).
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const another = submitter?.dataset.another === "true"
    return form.handleSubmit(
      (values) => submit(values, another),
      () => setFocusKey((k) => k + 1)
    )(event)
  }

  const summary = [
    ...(formMessage ? [{ message: formMessage }] : []),
    ...(formState.submitCount > 0 ? collectErrors(formState.errors, ORDER) : []),
  ]

  const isLastUsed = (key: keyof LastUsed, value: EntityOption | null) =>
    !isEdit && value && lastUsed?.[key]?._id === value._id

  const lastUsedTag = (
    <Badge variant="outline" className="mr-1 h-5 shrink-0 text-[11px] font-normal">
      Last used
    </Badge>
  )

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit purchase" : "New purchase"}
      description={isEdit ? undefined : "Scrap coming in from a supplier. Stock goes up when you save."}
      isDirty={formState.isDirty && !formState.isSubmitSuccessful}
      recordName="purchase"
      onDiscard={draft.clear}
      footer={
        // Phones: Save on top, full width; Cancel and "Save & add another" share the row below.
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
          <FormSheetCancel className={isEdit ? "col-span-2" : undefined} />
          {!isEdit ? (
            <Button
              type="submit"
              form="purchase-form"
              variant="secondary"
              className="h-11 sm:h-9"
              data-another="true"
            >
              Save &amp; add another
            </Button>
          ) : null}
          <Button
            type="submit"
            form="purchase-form"
            className="order-first col-span-2 h-12 min-w-36 sm:order-none sm:h-9"
            aria-busy={save.isPending}
          >
            {save.isPending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : isEdit ? (
              <>
                Save changes <SaveKeyHint />
              </>
            ) : (
              <>
                Save purchase <SaveKeyHint />
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="purchase-form" onSubmit={onSubmit} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <DraftNotice savedAt={draft.restored?.savedAt ?? null} onDiscard={draft.discard} />
        <FieldGroup className="gap-6">
          <FieldSet className="gap-4">
            <FieldLegend>What &amp; who</FieldLegend>
            <FormField control={control} name="purchaseDate" label="Date">
              {(field, props) => (
                <DateInput {...props} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
              )}
            </FormField>
            <FormField control={control} name="supplier" label="Supplier">
              {(field, props) => (
                <EntityCombobox
                  {...props}
                  kind="supplier"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  placeholder="Choose a supplier"
                  noun="suppliers"
                  allowCreate
                  tag={isLastUsed("supplier", field.value) ? lastUsedTag : null}
                />
              )}
            </FormField>
            <FormField control={control} name="material" label="Material">
              {(field, props) => (
                <EntityCombobox
                  {...props}
                  kind="material"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  placeholder="Choose a material"
                  noun="materials"
                  allowCreate
                  tag={isLastUsed("material", field.value) ? lastUsedTag : null}
                />
              )}
            </FormField>
          </FieldSet>

          <FieldSet className="gap-4">
            <FieldLegend>Quantity &amp; price</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name="quantityTons" label="Tons">
                {(field, props) => (
                  <TonsInput
                    {...props}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="0.000"
                  />
                )}
              </FormField>
              <FormField
                control={control}
                name="ratePerTon"
                label="Rate per ton"
                description={
                  lastRate
                    ? `Last rate from ${lastRate.companyId.name}: ${formatRate(lastRate.ratePerTon)} on ${formatDate(lastRate.purchaseDate)}`
                    : undefined
                }
              >
                {(field, props) => (
                  <RateInput
                    {...props}
                    ref={field.ref}
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="0.00"
                  />
                )}
              </FormField>
            </div>
            <div className="flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Amount</span>
              <output className="text-lg font-semibold tabular-nums" aria-live="polite">
                {amount ? formatMoney(amount) : "₹0.00"}
              </output>
            </div>
          </FieldSet>

          <FieldSet className="gap-4">
            <FieldLegend>Transport &amp; paperwork</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name="vehicleNumber" label="Vehicle number" optional>
                {(field, props) => (
                  <Input
                    {...field}
                    {...props}
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="GJ03AX4521"
                    className="h-11 font-mono uppercase md:h-9"
                    onBlur={() => {
                      const tidy = normalizeCode(field.value)
                      if (tidy !== field.value) setValue("vehicleNumber", tidy, { shouldDirty: true })
                      field.onBlur()
                    }}
                  />
                )}
              </FormField>
              <FormField control={control} name="invoiceNumber" label="Invoice number" optional>
                {(field, props) => <Input {...field} {...props} className="h-11 md:h-9" />}
              </FormField>
            </div>
            <FormField control={control} name="notes" label="Notes" optional>
              {(field, props) => <Textarea {...field} {...props} rows={2} />}
            </FormField>
          </FieldSet>
        </FieldGroup>
      </form>
    </FormSheet>
  )
}
