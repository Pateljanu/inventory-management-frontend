import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { FormSheet, FormSheetCancel } from "@/components/common/form/form-sheet"
import { useOpenSession } from "@/hooks/use-open-session"
import { FormField } from "@/components/common/form/form-field"
import { ErrorSummary } from "@/components/common/form/error-summary"
import { TonsInput } from "@/components/common/form/tons-input"
import { ErrorState } from "@/components/common/error-state"
import { materialQuery, useSaveMaterial, type MaterialInput } from "./api"
import { isApiError } from "@/lib/api-client"
import { applyServerErrors, collectErrors, fieldId } from "@/lib/form-errors"
import { qty, toBig } from "@/lib/decimal"
import { formatDate, formatTons } from "@/lib/format"
import { notify } from "@/lib/notify"
import type { Material } from "@/types/api"

const TONS = /^\d{1,12}(\.\d{1,3})?$/

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the material name (at least 2 letters)")
    .max(120, "Keep the name under 120 characters"),
  openingStockTons: z.string().refine((v) => v === "" || TONS.test(v), "Enter tons as a number, like 12.450"),
  notes: z.string().trim().max(1000, "Keep notes under 1,000 characters"),
  isActive: z.boolean(),
})

type Values = z.input<typeof schema>
const ORDER = ["name", "openingStockTons", "notes"] as const

const toValues = (m?: Material): Values => ({
  name: m?.name ?? "",
  // Blank rather than "0.000" for a new material, so the user types over nothing.
  openingStockTons: m && !toBig(m.openingStockTons).eq(0) ? toBig(m.openingStockTons).toString() : "",
  notes: m?.notes ?? "",
  isActive: m?.isActive ?? true,
})

type MaterialSheetProps = {
  open: boolean
  materialId?: string
  onClose: () => void
  onSaved: (material: Material) => void
}

export function MaterialSheet({ open, materialId, onClose, onSaved }: MaterialSheetProps) {
  const existing = useQuery({ ...materialQuery(materialId ?? ""), enabled: open && Boolean(materialId) })
  const session = useOpenSession(open)

  if (materialId && !existing.data) {
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title="Edit material"
        isDirty={false}
        recordName="material"
        footer={null}
      >
        {existing.error ? (
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </FormSheet>
    )
  }

  return (
    <MaterialForm
      key={`${materialId ?? "new"}-${session}`}
      open={open}
      material={materialId ? existing.data : undefined}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function MaterialForm({
  open,
  material,
  onClose,
  onSaved,
}: {
  open: boolean
  material?: Material
  onClose: () => void
  onSaved: (material: Material) => void
}) {
  const isEdit = Boolean(material)
  const save = useSaveMaterial()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(material),
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const { control, formState } = form

  const toInput = (values: Values): Partial<MaterialInput> => {
    const opening = qty(values.openingStockTons || "0")
    if (!isEdit) {
      return {
        name: values.name.trim(),
        ...(values.openingStockTons ? { openingStockTons: opening } : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      }
    }
    return {
      name: values.name.trim(),
      notes: values.notes.trim(),
      isActive: values.isActive,
      // Only a real change re-checks the stock history on the server.
      ...(formState.dirtyFields.openingStockTons ? { openingStockTons: opening } : {}),
    }
  }

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (save.isPending) return
      setFormMessage(null)
      try {
        const saved = await save.mutateAsync({ id: material?._id, input: toInput(values) })
        notify.success(isEdit ? "Material saved" : "Material added", { description: saved.name })
        onSaved(saved)
      } catch (error) {
        if (isApiError(error) && error.code === "NEGATIVE_STOCK_HISTORY") {
          const at = formatDate(String(error.details?.at ?? ""))
          const short = formatTons(
            toBig(String(error.details?.balanceTons ?? "0"))
              .abs()
              .toFixed(3),
            { unit: true }
          )
          form.setError("openingStockTons", {
            type: "server",
            message: `Opening stock can't be this low: on ${at} more of this material had already been delivered than you had (short by ${short}).`,
          })
        } else {
          const { formMessage } = applyServerErrors(error, form.setError, ORDER, {
            fieldMap: { normalizedName: "name" },
            duplicateMessages: {
              name: "A material with this name already exists. Search for it in the list, or use a different name.",
            },
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
      title={isEdit ? `Edit ${material!.name}` : "New material"}
      description={isEdit ? undefined : "A scrap grade you buy and sell, like HMS 1 or Brass honey."}
      isDirty={formState.isDirty && !formState.isSubmitSuccessful}
      recordName="material"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <FormSheetCancel />
          <Button
            type="submit"
            form="material-form"
            className="h-11 min-w-32 sm:h-9"
            aria-busy={save.isPending}
          >
            {save.isPending ? (
              <>
                <Spinner /> Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Add material"
            )}
          </Button>
        </div>
      }
    >
      <form id="material-form" onSubmit={onSubmit} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <FieldGroup className="gap-5">
          <FormField control={control} name="name" label="Material name">
            {(field, props) => <Input {...field} {...props} className="h-11 md:h-9" autoFocus={!isEdit} />}
          </FormField>

          <FormField
            control={control}
            name="openingStockTons"
            label="Opening stock"
            optional
            description="Scrap already in the yard before you started recording purchases. It isn't linked to any supplier, so deliveries can't draw on it."
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
                className="md:max-w-44"
              />
            )}
          </FormField>

          <FormField control={control} name="notes" label="Notes" optional>
            {(field, props) => <Textarea {...field} {...props} rows={3} />}
          </FormField>

          {isEdit ? (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor={fieldId("isActive")}>Active</FieldLabel>
                    <FieldDescription className="text-xs">
                      Inactive materials stay in past records but can&apos;t be picked for new purchases or
                      orders.
                    </FieldDescription>
                  </FieldContent>
                  <Switch id={fieldId("isActive")} checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
          ) : null}
        </FieldGroup>
      </form>
    </FormSheet>
  )
}
