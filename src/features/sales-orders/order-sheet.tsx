import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { DecimalInput, RateInput, TonsInput } from "@/components/common/form/tons-input"
import { DEFAULT_TOLERANCE_PERCENT, MAX_TOLERANCE_PERCENT, maxDeliverable } from "./tolerance"
import { ErrorState } from "@/components/common/error-state"
import { salesOrderQuery, useSaveSalesOrder, type SalesOrderInput } from "./api"
import { isApiError } from "@/lib/api-client"
import { applyServerErrors, collectErrors } from "@/lib/form-errors"
import { amountFrom, isPositive, toBig } from "@/lib/decimal"
import { businessToday, isDateOnly, toDateOnly } from "@/lib/dates"
import { formatDate, formatMoney, formatTons } from "@/lib/format"
import { readLastUsed, writeLastUsed } from "@/lib/last-used"
import { notify } from "@/lib/notify"
import { stockHistoryMessage } from "@/lib/stock-errors"
import type { EntityOption } from "@/features/lookups/api"
import type { SalesPO, Saved } from "@/types/api"

const TONS = /^\d{1,12}(\.\d{1,3})?$/
const RATE = /^\d{1,12}(\.\d{1,2})?$/
const entity = z.object({ _id: z.string(), name: z.string() }).nullable()

const schema = z.object({
  poNumber: z
    .string()
    .trim()
    .min(1, "Enter the buyer's PO number, like PO-0142")
    .max(80, "Keep the PO number under 80 characters"),
  poDate: z.string().refine(isDateOnly, "Choose the order date"),
  buyer: entity.refine((v) => v !== null, "Choose a buyer"),
  material: entity.refine((v) => v !== null, "Choose a material"),
  quantityTons: z
    .string()
    .refine((v) => v !== "", "Enter the ordered tons, like 30.000")
    .refine(
      (v) => v === "" || (TONS.test(v) && isPositive(v)),
      "Enter tons as a number above zero, like 30.000"
    ),
  ratePerTon: z
    .string()
    .refine((v) => v !== "", "Enter the selling rate per ton, like 38,500")
    .refine(
      (v) => v === "" || (RATE.test(v) && isPositive(v)),
      "Enter the rate as a number above zero, like 38,500"
    ),
  // Missing in drafts saved before the field existed.
  tolerancePercent: z
    .string()
    .optional()
    .refine(
      (v) => !v || (RATE.test(v) && Number(v) <= MAX_TOLERANCE_PERCENT),
      `Enter a percentage from 0 to ${MAX_TOLERANCE_PERCENT}, like 5`
    ),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
})

type Values = z.input<typeof schema>
const ORDER = [
  "poNumber",
  "poDate",
  "buyer",
  "material",
  "quantityTons",
  "ratePerTon",
  "tolerancePercent",
  "notes",
] as const
const LAST_KEY = "sales-order"
type LastUsed = { buyer?: EntityOption }

function toValues(po?: SalesPO): Values {
  if (!po) {
    return {
      poNumber: "",
      poDate: businessToday(),
      buyer: readLastUsed<LastUsed>(LAST_KEY)?.buyer ?? null,
      material: null,
      quantityTons: "",
      ratePerTon: "",
      tolerancePercent: DEFAULT_TOLERANCE_PERCENT,
      notes: "",
    }
  }
  return {
    poNumber: po.poNumber,
    poDate: toDateOnly(po.poDate) ?? businessToday(),
    buyer: { _id: po.companyId._id, name: po.companyId.name },
    material: { _id: po.materialId._id, name: po.materialId.name },
    quantityTons: toBig(po.quantityTons).toString(),
    ratePerTon: toBig(po.ratePerTon).toString(),
    tolerancePercent: toBig(po.tolerancePercent ?? "0").toString(),
    notes: po.notes ?? "",
  }
}

const toInput = (v: Values): SalesOrderInput => ({
  poNumber: v.poNumber.trim(),
  poDate: v.poDate,
  companyId: v.buyer!._id,
  materialId: v.material!._id,
  quantityTons: v.quantityTons,
  ratePerTon: v.ratePerTon,
  tolerancePercent: v.tolerancePercent === undefined ? DEFAULT_TOLERANCE_PERCENT : v.tolerancePercent || "0",
  notes: v.notes.trim(),
})

type OrderSheetProps = {
  open: boolean
  orderId?: string
  onClose: () => void
  onSaved: (order: Saved<SalesPO>) => void
}

export function OrderSheet({ open, orderId, onClose, onSaved }: OrderSheetProps) {
  const existing = useQuery({ ...salesOrderQuery(orderId ?? ""), enabled: open && Boolean(orderId) })
  const session = useOpenSession(open)

  if (orderId && !existing.data) {
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title="Edit sales order"
        isDirty={false}
        recordName="order"
        footer={null}
      >
        {existing.error ? (
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
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
    <OrderForm
      key={`${orderId ?? "new"}-${session}`}
      open={open}
      order={orderId ? existing.data : undefined}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function OrderForm({
  open,
  order,
  onClose,
  onSaved,
}: {
  open: boolean
  order?: SalesPO
  onClose: () => void
  onSaved: (order: Saved<SalesPO>) => void
}) {
  const isEdit = Boolean(order)
  const save = useSaveSalesOrder()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(order),
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const { control, formState } = form
  const draft = useFormDraft(form, { name: "sales-order", context: "new", enabled: !isEdit })
  const [quantity, rate, tolerance] = useWatch({
    control,
    name: ["quantityTons", "ratePerTon", "tolerancePercent"],
  })
  const total = TONS.test(quantity) && RATE.test(rate) ? amountFrom(quantity, rate) : null
  const delivered = order && isPositive(order.soldQuantityTons) ? order.soldQuantityTons : null

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (save.isPending) return
      setFormMessage(null)
      try {
        const saved = await save.mutateAsync({ id: order?._id, input: toInput(values) })
        draft.clear()
        writeLastUsed<LastUsed>(LAST_KEY, { buyer: values.buyer! })
        notify.success(isEdit ? "Sales order saved" : "Sales order added", {
          description: `${saved.poNumber} · ${formatTons(saved.quantityTons, { unit: true })} of ${values.material!.name} for ${values.buyer!.name}`,
        })
        onSaved(saved)
      } catch (error) {
        const code = isApiError(error) ? error.code : ""
        const stock = stockHistoryMessage(error)
        if (stock) {
          form.setError("material", { type: "server", message: stock })
        } else if (code === "PO_QTY_BELOW_SOLD") {
          const sold = String(
            (error as { details?: { soldQuantityTons?: string } }).details?.soldQuantityTons ?? "0"
          )
          form.setError("quantityTons", {
            type: "server",
            message: `${formatTons(sold, { unit: true })} has already been delivered on this order. Ordered tons plus the tolerance must cover it.`,
          })
        } else if (code === "PO_DATE_AFTER_SALES") {
          const first = String(
            (error as { details?: { firstSaleDate?: string } }).details?.firstSaleDate ?? ""
          )
          form.setError("poDate", {
            type: "server",
            message: `The first delivery was on ${formatDate(first)}. The order date must be on or before that day.`,
          })
        } else if (code === "INVALID_SALE_COMPANY") {
          form.setError("buyer", {
            type: "server",
            message: "This company is inactive or isn't a buyer. Choose another.",
          })
        } else if (code === "INVALID_MATERIAL") {
          form.setError("material", { type: "server", message: "This material is inactive. Choose another." })
        } else {
          const { formMessage } = applyServerErrors(error, form.setError, ORDER, {
            fieldMap: { companyId: "buyer", materialId: "material", normalizedPoNumber: "poNumber" },
            duplicateMessages: { poNumber: "This buyer already has an order with this PO number." },
          })
          setFormMessage(formMessage)
        }
        setFocusKey((k) => k + 1)
      }
    },
    () => setFocusKey((k) => k + 1)
  )

  const summary = [
    ...(formMessage ? [{ message: formMessage }] : []),
    ...(formState.submitCount > 0 ? collectErrors(formState.errors, ORDER) : []),
  ]

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${order!.poNumber}` : "New sales order"}
      description={isEdit ? undefined : "An order from a buyer. Deliveries are recorded against it."}
      isDirty={formState.isDirty && !formState.isSubmitSuccessful}
      recordName="order"
      onDiscard={draft.clear}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <FormSheetCancel />
          <Button type="submit" form="order-form" className="h-12 min-w-36 sm:h-9" aria-busy={save.isPending}>
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
                Add sales order <SaveKeyHint />
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="order-form" onSubmit={onSubmit} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <DraftNotice savedAt={draft.restored?.savedAt ?? null} onDiscard={draft.discard} />
        <FieldGroup className="gap-6">
          <FieldSet className="gap-4">
            <FieldLegend>Order</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name="poNumber" label="PO number">
                {(field, props) => (
                  <Input
                    {...field}
                    {...props}
                    placeholder="PO-0142"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="h-11 md:h-9"
                    autoFocus={!isEdit}
                  />
                )}
              </FormField>
              <FormField control={control} name="poDate" label="Order date">
                {(field, props) => (
                  <DateInput {...props} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                )}
              </FormField>
            </div>
            <FormField control={control} name="buyer" label="Buyer">
              {(field, props) => (
                <EntityCombobox
                  {...props}
                  kind="buyer"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  placeholder="Choose a buyer"
                  noun="buyers"
                  allowCreate
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
                />
              )}
            </FormField>
          </FieldSet>

          <FieldSet className="gap-4">
            <FieldLegend>Quantity &amp; price</FieldLegend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={control}
                name="quantityTons"
                label="Ordered tons"
                description={
                  delivered ? `${formatTons(delivered, { unit: true })} already delivered` : undefined
                }
              >
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
                label="Selling rate per ton"
                description={
                  isEdit
                    ? "A new rate applies to future deliveries; past deliveries keep their rate."
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
            <FormField
              control={control}
              name="tolerancePercent"
              label="Tolerance (±)"
              description={
                quantity && isPositive(quantity)
                  ? `Deliveries can go up to ${formatTons(maxDeliverable(quantity, tolerance), { unit: true })}. Extra tons are billed at the same rate.`
                  : "How far deliveries may go beyond the ordered tons."
              }
            >
              {(field, props) => (
                <DecimalInput
                  {...props}
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  decimals={2}
                  suffix="%"
                  placeholder="0"
                  className="sm:max-w-40"
                />
              )}
            </FormField>
            <div className="flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Order value</span>
              <output className="text-lg font-semibold tabular-nums" aria-live="polite">
                {total ? formatMoney(total) : "₹0.00"}
              </output>
            </div>
          </FieldSet>

          <FormField control={control} name="notes" label="Notes" optional>
            {(field, props) => <Textarea {...field} {...props} rows={2} />}
          </FormField>
        </FieldGroup>
      </form>
    </FormSheet>
  )
}
