import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Lock } from "lucide-react"
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
import { TonsInput } from "@/components/common/form/tons-input"
import { ErrorState } from "@/components/common/error-state"
import { OrderProgress } from "@/features/sales-orders/order-parts"
import { salesOrderQuery } from "@/features/sales-orders/api"
import type { EntityOption } from "@/features/lookups/api"
import { DeliveryLimitsPanel } from "./delivery-limits-panel"
import { capacityQuery, deliveryKeys, deliveryQuery, openOrderOptionsQuery, useSaveDelivery } from "./api"
import type { DeliveryInput } from "./api"
import {
  extraOverOrder,
  limitKindFromCode,
  overLimitMessage,
  sourceDateProblem,
  typedTons,
  type LimitNames,
} from "./limits"
import { useIsMobile } from "@/hooks/use-mobile"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { isApiError } from "@/lib/api-client"
import { applyServerErrors, collectErrors } from "@/lib/form-errors"
import { amountFrom, cmp, isPositive, toBig } from "@/lib/decimal"
import { businessToday, compareDates, isDateOnly, toDateOnly } from "@/lib/dates"
import { formatDate, formatMoney, formatRate, formatTons } from "@/lib/format"
import { normalizeCode, readLastUsed, writeLastUsed } from "@/lib/last-used"
import { notify } from "@/lib/notify"
import { stockHistoryMessage } from "@/lib/stock-errors"
import { DEBOUNCE_LIMITS } from "@/lib/timing"
import type { Sale, SaleCapacity, SalesPO, Saved } from "@/types/api"

const TONS = /^\d{1,12}(\.\d{1,3})?$/
const entity = z.object({ _id: z.string(), name: z.string(), meta: z.string().optional() }).nullable()

const schema = z.object({
  po: entity.refine((v) => v !== null, "Choose the sales order"),
  saleDate: z.string().refine(isDateOnly, "Choose the delivery date"),
  source: entity.refine((v) => v !== null, "Choose whose stock this is"),
  quantityTons: z
    .string()
    .refine((v) => v !== "", "Enter the tons, like 6.000")
    .refine(
      (v) => v === "" || (TONS.test(v) && isPositive(v)),
      "Enter tons as a number above zero, like 6.000"
    ),
  vehicleNumber: z.string().max(30, "Keep the vehicle number under 30 characters"),
  challanNumber: z.string().trim().max(80, "Keep the challan number under 80 characters"),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
})

type Values = z.input<typeof schema>
const ORDER = ["po", "saleDate", "source", "quantityTons", "vehicleNumber", "challanNumber", "notes"] as const

/** A stable empty list: pickers treat a new array as new options. */
const NO_OPTIONS: EntityOption[] = []

type LastUsed = { source?: EntityOption }
const LAST_KEY = "delivery"

function fromSale(s: Sale): Values {
  return {
    po: { _id: s.poId._id, name: s.poId.poNumber },
    saleDate: toDateOnly(s.saleDate) ?? businessToday(),
    source: { _id: s.sourceCompanyId._id, name: s.sourceCompanyId.name },
    quantityTons: toBig(s.quantityTons).toString(),
    vehicleNumber: s.vehicleNumber ?? "",
    challanNumber: s.challanNumber ?? "",
    notes: s.notes ?? "",
  }
}

function blankValues(poId?: string): Values {
  return {
    // The order's number and buyer load in the order block; the id is all the form needs.
    po: poId ? { _id: poId, name: "" } : null,
    saleDate: businessToday(),
    source: null,
    quantityTons: "",
    vehicleNumber: "",
    challanNumber: "",
    notes: "",
  }
}

function toInput(v: Values): DeliveryInput {
  return {
    poId: v.po!._id,
    saleDate: v.saleDate,
    sourceCompanyId: v.source!._id,
    quantityTons: v.quantityTons,
    vehicleNumber: normalizeCode(v.vehicleNumber),
    challanNumber: v.challanNumber.trim(),
    notes: v.notes.trim(),
  }
}

type DeliverySheetProps = {
  open: boolean
  /** Edit this delivery. */
  deliveryId?: string
  /** Create with this order already chosen ("Deliver" on an order). */
  poId?: string
  onClose: () => void
  onSaved: (delivery: Saved<Sale>, opts: { another: boolean }) => void
}

export function DeliverySheet({ open, deliveryId, poId, onClose, onSaved }: DeliverySheetProps) {
  const source = useQuery({ ...deliveryQuery(deliveryId ?? ""), enabled: open && Boolean(deliveryId) })
  const session = useOpenSession(open)

  if (deliveryId && !source.data) {
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title="Edit delivery"
        isDirty={false}
        recordName="delivery"
        footer={null}
        size="wide"
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
    <DeliveryForm
      key={`${deliveryId ?? `new-${poId ?? ""}`}-${session}`}
      open={open}
      editing={deliveryId ? source.data : undefined}
      initial={deliveryId && source.data ? fromSale(source.data) : blankValues(poId)}
      draftContext={deliveryId ? undefined : poId ? `order:${poId}` : "new"}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function DeliveryForm({
  open,
  editing,
  initial,
  draftContext,
  onClose,
  onSaved,
}: {
  open: boolean
  editing?: Sale
  initial: Values
  /** Keep unsaved typing as a draft for this kind of new delivery; off for edits. */
  draftContext?: string
  onClose: () => void
  onSaved: DeliverySheetProps["onSaved"]
}) {
  const isEdit = Boolean(editing)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const save = useSaveDelivery()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [lastUsed, setLastUsed] = useState(() => readLastUsed<LastUsed>(LAST_KEY))
  /** "Save & add another": the next entry, applied once the submit has fully finished. */
  const nextEntry = useRef<Values | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const { control, formState, setValue, getFieldState } = form
  const draft = useFormDraft(form, {
    name: "delivery",
    context: draftContext ?? "",
    // Only while the sheet is open: a closed sheet stays mounted, and the refetch after a save
    // refills its fields, which would otherwise leave the saved delivery behind as a "draft".
    enabled: Boolean(draftContext) && open,
  })
  const [changingOrder, setChangingOrder] = useState(() => !initial.po && !draft.restored?.values.po)
  const [po, saleDate, source, tons] = useWatch({
    control,
    name: ["po", "saleDate", "source", "quantityTons"],
  })

  const order = useQuery({ ...salesOrderQuery(po?._id ?? ""), enabled: Boolean(po) })
  // Whenever the picker shows: also after "Start over" empties a restored order.
  const orders = useQuery({ ...openOrderOptionsQuery(), enabled: changingOrder || !po })
  // An order opened from a link is known by id until its number loads. Keyed on id and name:
  // useWatch returns a fresh copy of the object on every form update, and the picker treats a
  // new object as a new value (re-syncing on each render, in a loop).
  const poId = po?._id
  const poName = po?.name || order.data?.poNumber || ""
  const poOption = useMemo(() => (poId ? { _id: poId, name: poName } : null), [poId, poName])

  // Limits follow the order, date and supplier; typing a date doesn't fire a request per key.
  const liveKey = [po?._id ?? "", isDateOnly(saleDate) ? saleDate : "", source?._id ?? ""].join("|")
  const paramsKey = useDebouncedValue(liveKey, DEBOUNCE_LIMITS)
  const params = useMemo(() => {
    const [poId, date, sourceId] = paramsKey.split("|")
    return {
      poId,
      saleDate: date,
      sourceCompanyId: sourceId || undefined,
      excludeSaleId: editing?._id,
    }
  }, [paramsKey, editing?._id])
  const capacity = useQuery({
    ...capacityQuery(params),
    enabled: Boolean(params.poId && params.saleDate),
  })
  /** Limits for exactly what is on screen now (not a moment ago), or null while they load. */
  const current =
    capacity.data && !capacity.isPlaceholderData && !capacity.isFetching && paramsKey === liveKey
      ? capacity.data
      : null
  /** Typed tons beyond what was ordered (allowed up to the order's tolerance). */
  const extraTons = current ? extraOverOrder(current, tons ?? "") : null

  const material = order.data?.materialId.name ?? "this material"
  const poolOf = (c: SaleCapacity | null | undefined) =>
    c && c.poId === po?._id && source ? c.sources.find((s) => s.sourceCompanyId === source._id) : undefined
  /** The chosen supplier's stock of this material, for the panel (may be a moment old). */
  const pool = poolOf(capacity.data)
  const names: LimitNames = {
    poNumber: order.data?.poNumber ?? po?.name ?? "this order",
    tolerancePercent: order.data?.tolerancePercent ?? null,
    material,
    source: source?.name ?? null,
    saleDate,
    // The first purchase date doesn't depend on the delivery date, so a moment-old pool is fine.
    sourceFirstPurchaseDate: pool ? pool.firstPurchaseDate : undefined,
  }

  // Suppliers holding this material, most stock first ("Shree Ganesh Metals · 9.200 t · bought 08/09/2026").
  const sourceOptions = useMemo<EntityOption[]>(
    () =>
      (capacity.data?.sources ?? [])
        .filter((s) => s.isActive || s.sourceCompanyId === source?._id)
        .map((s) => ({
          _id: s.sourceCompanyId,
          name: s.name,
          meta: [
            formatTons(s.availableTons, { unit: true }),
            s.lastPurchaseDate ? `bought ${formatDate(s.lastPurchaseDate)}` : null,
            lastUsed?.source?._id === s.sourceCompanyId ? "Last used" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    [capacity.data?.sources, source?._id, lastUsed]
  )

  // Smart defaults on a new delivery: the last-used supplier if it holds this material (or the
  // only one that does), then the most that can be delivered.
  // Effects depend on ids, never on watched objects: useWatch hands back a fresh copy after
  // every form update, so an object dependency would re-run the effect (and setValue) forever.
  const sourceId = source?._id
  // Tons the user typed (or brought back in a draft) stay; tons the form filled in follow the
  // limits. Not the field's dirty flag: merely leaving the box marks a filled-in value as dirty.
  const autoTons = useRef<string | null>(null)
  const tonsTyped = () => {
    const tons = form.getValues("quantityTons")
    return tons !== "" && tons !== autoTons.current
  }

  // Filled-in values re-check a field that shows an error, so a stale message doesn't stay put.
  useEffect(() => {
    if (!open || isEdit || sourceId || !capacity.data || capacity.data.poId !== poId) return
    const withStock = capacity.data.sources.filter((s) => s.isActive && isPositive(s.availableTons))
    const pick =
      withStock.find((s) => s.sourceCompanyId === lastUsed?.source?._id) ??
      (withStock.length === 1 ? withStock[0] : undefined)
    if (pick)
      setValue(
        "source",
        { _id: pick.sourceCompanyId, name: pick.name },
        { shouldDirty: false, shouldValidate: Boolean(getFieldState("source").error) }
      )
  }, [open, isEdit, sourceId, capacity.data, poId, lastUsed, getFieldState, setValue])

  useEffect(() => {
    if (!open || isEdit || !current || !sourceId || tonsTyped()) return
    const max = toBig(current.maxAllowedTons)
    autoTons.current = max.gt(0) ? max.toString() : ""
    setValue("quantityTons", autoTons.current, {
      shouldDirty: false,
      shouldValidate: Boolean(getFieldState("quantityTons").error),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tonsTyped reads refs and form values
  }, [open, isEdit, current, sourceId, getFieldState, setValue])

  // An edited delivery keeps its own rate unless it moves to another order.
  const rate =
    editing && editing.poId._id === po?._id ? editing.poRateAtSale : (order.data?.ratePerTon ?? null)
  const amount = rate && TONS.test(tons) && isPositive(tons) ? amountFrom(tons, rate) : null

  const fillMax = (max: string) => {
    setValue("quantityTons", toBig(max).toString(), { shouldDirty: true, shouldValidate: true })
    form.setFocus("quantityTons")
  }

  /** Client-side checks that need the order or the limits; the server checks again on save. */
  const checkLimits = (values: Values): boolean => {
    let ok = true
    if (order.data && compareDates(values.saleDate, toDateOnly(order.data.poDate)!) < 0) {
      form.setError("saleDate", {
        type: "limits",
        message: `The delivery date can't be before the order date, ${formatDate(order.data.poDate)}.`,
      })
      ok = false
    }
    const movedOrder = !editing || editing.poId._id !== values.po?._id
    const currentPool = poolOf(current)
    const dateProblem = current
      ? sourceDateProblem({
          ...names,
          saleDate: values.saleDate,
          sourceFirstPurchaseDate: currentPool ? currentPool.firstPurchaseDate : undefined,
        })
      : null
    if (current && !current.poOpen && movedOrder) {
      form.setError("po", {
        type: "limits",
        message: `${names.poNumber} is cancelled. Choose another order.`,
      })
      ok = false
    } else if (dateProblem && cmp(values.quantityTons, current!.maxAllowedTons) > 0) {
      // The supplier had nothing yet on this date: the fix is the date or the supplier.
      form.setError(dateProblem.field, { type: "limits", message: dateProblem.message })
      ok = false
    } else if (current && cmp(values.quantityTons, current.maxAllowedTons) > 0) {
      form.setError("quantityTons", {
        type: "limits",
        message: overLimitMessage(current.limitedBy, current.maxAllowedTons, names),
      })
      ok = false
    }
    return ok
  }

  const submit = async (values: Values, another: boolean) => {
    if (save.isPending) return
    setFormMessage(null)
    if (!checkLimits(values)) {
      setFocusKey((k) => k + 1)
      return
    }
    try {
      const saved = await save.mutateAsync({ id: editing?._id, input: toInput(values) })
      draft.clear()
      const used: LastUsed = { source: { _id: values.source!._id, name: values.source!.name } }
      writeLastUsed<LastUsed>(LAST_KEY, used)
      setLastUsed(used)
      const buyer = order.data?.companyId.name
      notify.success(isEdit ? "Delivery updated" : "Delivery saved", {
        description: `${formatTons(saved.quantityTons, { unit: true })} of ${material}${buyer ? ` to ${buyer}` : ""} · ${formatMoney(saved.totalAmount)}`,
        action: {
          label: "View order",
          onClick: () => navigate({ to: "/sales-orders/$orderId", params: { orderId: saved.poId } }),
        },
      })
      if (another) {
        // Next truck: keep the order, date and supplier; tons refill with the new max. An order this
        // delivery finished, or a supplier it emptied, can't take the next truck: choose again.
        // (Numbers from before the save, less what was just delivered.)
        const orderDone = order.data
          ? !toBig(order.data.remainingQuantityTons).minus(saved.quantityTons).gt(0)
          : false
        const pool = poolOf(current)
        const sourceEmpty = pool ? !toBig(pool.availableTons).minus(saved.quantityTons).gt(0) : false
        nextEntry.current = {
          ...blankValues(),
          po: orderDone ? null : values.po,
          saleDate: values.saleDate,
          source: orderDone || sourceEmpty ? null : values.source,
        }
      }
      onSaved(saved, { another })
    } catch (error) {
      handleSaveError(error)
      setFocusKey((k) => k + 1)
    }
  }

  const handleSaveError = (error: unknown) => {
    const stock = stockHistoryMessage(error)
    if (stock) return form.setError("quantityTons", { type: "server", message: stock })
    if (!isApiError(error)) return setFormMessage(applyServerErrors(error, form.setError, ORDER).formMessage)

    const kind = limitKindFromCode(error.code)
    if (kind) {
      // Someone else may have delivered meanwhile: show the server's fresh numbers.
      void queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      const max = String(error.details?.maxAllowedTons ?? "0")
      const first = error.details?.sourceFirstPurchaseDate
      const serverNames: LimitNames = {
        ...names,
        saleDate: form.getValues("saleDate"),
        sourceFirstPurchaseDate: typeof first === "string" || first === null ? first : undefined,
      }
      const dateProblem = kind === "SOURCE_STOCK" && !isPositive(max) ? sourceDateProblem(serverNames) : null
      if (dateProblem)
        return form.setError(dateProblem.field, { type: "server", message: dateProblem.message })
      return form.setError("quantityTons", {
        type: "server",
        message: overLimitMessage(kind, max, serverNames),
      })
    }
    switch (error.code) {
      case "PO_NOT_AVAILABLE":
        return form.setError("po", {
          type: "server",
          message: `${names.poNumber} is cancelled. Choose another order.`,
        })
      case "SALE_BEFORE_PO_DATE":
        return form.setError("saleDate", {
          type: "server",
          message: `The delivery date can't be before the order date, ${formatDate(String(error.details?.poDate ?? ""))}.`,
        })
      case "INVALID_SOURCE_COMPANY":
        return form.setError("source", {
          type: "server",
          message: "This supplier is inactive or isn't a supplier. Choose another.",
        })
      case "INVALID_SALE_COMPANY":
        return form.setError("po", {
          type: "server",
          message: "This order's buyer is inactive. Reactivate the buyer or choose another order.",
        })
      case "INVALID_MATERIAL":
        return form.setError("po", {
          type: "server",
          message: `${material} is inactive. Reactivate it to deliver against this order.`,
        })
      case "PO_NOT_FOUND":
        return form.setError("po", {
          type: "server",
          message: "This order no longer exists. Choose another.",
        })
    }
    const { formMessage } = applyServerErrors(error, form.setError, ORDER, {
      fieldMap: { poId: "po", sourceCompanyId: "source", normalizedChallanNumber: "challanNumber" },
      duplicateMessages: { challanNumber: "This buyer already has a delivery with this challan number." },
    })
    setFormMessage(formMessage)
  }

  // "Save & add another" is told apart by the button that submitted the form (Ctrl+Enter = plain save).
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const another = submitter?.dataset.another === "true"
    await form.handleSubmit(
      (values) => submit(values, another),
      () => setFocusKey((k) => k + 1)
    )(event)
    // Reset only now: handleSubmit marks the form submitted when it finishes, and a reset inside
    // it would leave the next entry "submitted" (live errors, no unsaved-changes prompt on close).
    const next = nextEntry.current
    if (!next) return
    nextEntry.current = null
    form.reset(next)
    if (!next.po) setChangingOrder(true)
    window.setTimeout(() => form.setFocus(!next.po ? "po" : !next.source ? "source" : "quantityTons"), 50)
  }

  const summary = [
    ...(formMessage ? [{ message: formMessage }] : []),
    ...(formState.submitCount > 0 ? collectErrors(formState.errors, ORDER) : []),
  ]

  const panel = (
    <DeliveryLimitsPanel
      capacity={capacity.data?.poId === po?._id ? capacity.data : undefined}
      idle={!po}
      loading={capacity.isPending && Boolean(po)}
      updating={capacity.isFetching || capacity.isPlaceholderData || paramsKey !== liveKey}
      error={capacity.error}
      onRetry={() => capacity.refetch()}
      tons={tons}
      names={names}
      pool={pool}
      onUseMax={fillMax}
    />
  )

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      size="wide"
      title={isEdit ? "Edit delivery" : "Record delivery"}
      description={
        order.data
          ? `${order.data.poNumber} · ${order.data.companyId.name}`
          : "Scrap going out to a buyer against their order. Stock goes down when you save."
      }
      isDirty={formState.isDirty && !formState.isSubmitSuccessful}
      recordName="delivery"
      onDiscard={draft.clear}
      footer={
        // Phones: Save on top, full width; Cancel and "Save & add another" share the row below.
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
          <FormSheetCancel className={isEdit ? "col-span-2" : undefined} />
          {!isEdit ? (
            <Button
              type="submit"
              form="delivery-form"
              variant="secondary"
              className="h-11 sm:h-9"
              data-another="true"
            >
              Save &amp; add another
            </Button>
          ) : null}
          <Button
            type="submit"
            form="delivery-form"
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
                Save delivery <SaveKeyHint />
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="delivery-form" onSubmit={onSubmit} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <DraftNotice savedAt={draft.restored?.savedAt ?? null} onDiscard={draft.discard} />
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16.5rem]">
          <FieldGroup className="gap-6">
            <FieldSet className="gap-4">
              <FieldLegend>Sales order</FieldLegend>
              {changingOrder || !po ? (
                <FormField
                  control={control}
                  name="po"
                  label="Order"
                  description="Open orders only. Search by PO number or buyer."
                >
                  {(field, props) => (
                    <EntityCombobox
                      {...props}
                      options={orders.data ?? NO_OPTIONS}
                      optionsLoading={orders.isPending}
                      value={poOption}
                      onChange={(next) => {
                        field.onChange(next)
                        // Another order may be another material: its suppliers and limits differ.
                        setValue("source", null)
                        if (!tonsTyped()) setValue("quantityTons", "")
                        if (next) setChangingOrder(false)
                      }}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      placeholder="Choose an order"
                      noun="open orders"
                    />
                  )}
                </FormField>
              ) : (
                <OrderBlock
                  loading={order.isPending}
                  error={order.error}
                  onRetry={() => order.refetch()}
                  order={order.data}
                  rate={rate}
                  onChange={() => setChangingOrder(true)}
                  invalid={Boolean(formState.errors.po)}
                  errorMessage={formState.errors.po?.message}
                />
              )}
            </FieldSet>

            <FieldSet className="gap-4">
              <FieldLegend>Delivery</FieldLegend>
              <FormField control={control} name="saleDate" label="Date">
                {(field, props) => (
                  <DateInput
                    {...props}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    min={order.data ? (toDateOnly(order.data.poDate) ?? undefined) : undefined}
                  />
                )}
              </FormField>
              <FormField
                control={control}
                name="source"
                label="Stock from"
                description={po ? `Suppliers holding ${material}, most stock first.` : undefined}
              >
                {(field, props) => (
                  <EntityCombobox
                    {...props}
                    options={sourceOptions}
                    optionsLoading={Boolean(po) && capacity.isPending}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    placeholder={po ? "Choose a supplier" : "Choose an order first"}
                    noun={`suppliers holding ${material}`}
                    tag={
                      !isEdit && field.value && lastUsed?.source?._id === field.value._id ? (
                        <Badge variant="outline" className="mr-1 h-5 shrink-0 text-[11px] font-normal">
                          Last used
                        </Badge>
                      ) : null
                    }
                  />
                )}
              </FormField>

              {isMobile ? panel : null}

              <FormField
                control={control}
                name="quantityTons"
                label="Tons"
                description={
                  current && current.poOpen && isPositive(current.maxAllowedTons)
                    ? extraTons
                      ? `${formatTons(extraTons, { unit: true })} more than ordered, within the order's tolerance (up to ${formatTons(current.maxAllowedTons, { unit: true })}). Extra tons are billed at the order rate.`
                      : `Up to ${formatTons(current.maxAllowedTons, { unit: true })}`
                    : undefined
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
                    className="sm:max-w-48"
                  />
                )}
              </FormField>
              <div className="flex items-baseline justify-between rounded-lg bg-muted/60 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">
                  Amount
                  {rate && typedTons(tons) ? (
                    <span className="block text-xs tabular-nums">
                      {formatTons(tons, { unit: true })} × {formatRate(rate)}
                    </span>
                  ) : null}
                </span>
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
                      placeholder="GJ03BW7810"
                      className="h-11 font-mono uppercase md:h-9"
                      onBlur={() => {
                        const tidy = normalizeCode(field.value)
                        if (tidy !== field.value) setValue("vehicleNumber", tidy, { shouldDirty: true })
                        field.onBlur()
                      }}
                    />
                  )}
                </FormField>
                <FormField control={control} name="challanNumber" label="Challan number" optional>
                  {(field, props) => <Input {...field} {...props} className="h-11 md:h-9" />}
                </FormField>
              </div>
              <FormField control={control} name="notes" label="Notes" optional>
                {(field, props) => <Textarea {...field} {...props} rows={2} />}
              </FormField>
            </FieldSet>
          </FieldGroup>

          {!isMobile ? (
            <aside>
              <div className="sticky top-0">{panel}</div>
            </aside>
          ) : null}
        </div>
      </form>
    </FormSheet>
  )
}

/** The chosen order, read-only: number, buyer, material, rate and how much is delivered. */
function OrderBlock({
  loading,
  error,
  onRetry,
  order,
  rate,
  onChange,
  invalid,
  errorMessage,
}: {
  loading: boolean
  error: unknown
  onRetry: () => void
  order: SalesPO | undefined
  rate: string | null
  onChange: () => void
  invalid: boolean
  errorMessage?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        id="field-po"
        tabIndex={-1}
        className={
          invalid
            ? "rounded-xl border-2 border-destructive/60 bg-muted/40 p-4 outline-none"
            : "rounded-xl bg-muted/40 p-4 outline-none"
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : loading || !order ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2">
                <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-semibold whitespace-nowrap">{order.poNumber}</span>
                <span className="max-w-full truncate text-muted-foreground">{order.companyId.name}</span>
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto shrink-0 p-0"
                onClick={onChange}
              >
                Change order
              </Button>
            </div>
            <p>
              <span className="text-muted-foreground">Material </span>
              {order.materialId.name}
              <span className="text-muted-foreground"> · Rate </span>
              <span className="tabular-nums">{rate ? formatRate(rate) : formatRate(order.ratePerTon)}</span>
            </p>
            <OrderProgress po={order} detailed className="flex-wrap" />
          </div>
        )}
      </div>
      {errorMessage ? (
        <p className="text-sm text-destructive" id="field-po-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
