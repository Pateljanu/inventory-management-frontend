import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { FormSheet, FormSheetCancel } from "@/components/common/form/form-sheet"
import { useOpenSession } from "@/hooks/use-open-session"
import { FormField } from "@/components/common/form/form-field"
import { ErrorSummary } from "@/components/common/form/error-summary"
import { ErrorState } from "@/components/common/error-state"
import { companyQuery, useSaveCompany, type CompanyInput } from "./api"
import { COMPANY_TYPES } from "./company-types"
import { applyServerErrors, collectErrors, fieldId } from "@/lib/form-errors"
import { notify } from "@/lib/notify"
import type { Company, CompanyType } from "@/types/api"

// Same rules as the backend. Indian GSTIN: state code, PAN, entity code, "Z", checksum.
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const normalizeGst = (v: string) => v.replace(/\s+/g, "").toUpperCase()

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the company name (at least 2 letters)")
    .max(120, "Keep the name under 120 characters"),
  type: z.enum(["PURCHASE", "SALE", "BOTH"], { error: "Choose what you do with this company" }),
  gstNumber: z
    .string()
    .refine(
      (v) => v.trim() === "" || GSTIN.test(normalizeGst(v)),
      "Enter the GST number like 24AAACA1234A1Z5"
    ),
  person: z.string().trim().max(120, "Keep the name under 120 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Keep the phone number under 30 characters")
    .regex(/^[\d\s+()-]*$/, "Enter the phone number with digits only, like 98250 12345"),
  email: z.union([z.literal(""), z.email("Enter an email address like name@example.com")]),
  address: z.string().trim().max(500, "Keep the address under 500 characters"),
  isActive: z.boolean(),
})

type Values = z.input<typeof schema>
const ORDER = ["name", "type", "gstNumber", "person", "phone", "email", "address"] as const

function toValues(company?: Company): Values {
  return {
    name: company?.name ?? "",
    type: (company?.type ?? "") as CompanyType,
    gstNumber: company?.gstNumber ?? "",
    person: company?.contact?.person ?? "",
    phone: company?.contact?.phone ?? "",
    email: company?.contact?.email ?? "",
    address: company?.address ?? "",
    isActive: company?.isActive ?? true,
  }
}

function toInput(values: Values, isEdit: boolean): CompanyInput {
  const gst = normalizeGst(values.gstNumber)
  const contact = { person: values.person.trim(), phone: values.phone.trim(), email: values.email.trim() }
  if (isEdit) {
    // Edits send every field; empty strings clear stored values.
    return {
      name: values.name.trim(),
      type: values.type as CompanyType,
      gstNumber: gst,
      address: values.address.trim(),
      contact,
      isActive: values.isActive,
    }
  }
  const hasContact = Object.values(contact).some(Boolean)
  return {
    name: values.name.trim(),
    type: values.type as CompanyType,
    ...(gst ? { gstNumber: gst } : {}),
    ...(values.address.trim() ? { address: values.address.trim() } : {}),
    ...(hasContact ? { contact: Object.fromEntries(Object.entries(contact).filter(([, v]) => v)) } : {}),
  }
}

type CompanySheetProps = {
  open: boolean
  /** Edit this company; absent = create. */
  companyId?: string
  onClose: () => void
  onSaved: (company: Company) => void
}

export function CompanySheet({ open, companyId, onClose, onSaved }: CompanySheetProps) {
  const existing = useQuery({ ...companyQuery(companyId ?? ""), enabled: open && Boolean(companyId) })
  const session = useOpenSession(open)

  if (companyId && !existing.data) {
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title="Edit company"
        isDirty={false}
        recordName="company"
        footer={null}
      >
        {existing.error ? (
          <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
      </FormSheet>
    )
  }

  // Keyed so switching records starts from fresh defaults.
  return (
    <CompanyForm
      key={`${companyId ?? "new"}-${session}`}
      open={open}
      company={companyId ? existing.data : undefined}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function CompanyForm({
  open,
  company,
  onClose,
  onSaved,
}: {
  open: boolean
  company?: Company
  onClose: () => void
  onSaved: (company: Company) => void
}) {
  const isEdit = Boolean(company)
  const save = useSaveCompany()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState(0)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(company),
    mode: "onSubmit",
    reValidateMode: "onChange",
  })
  const { control, formState } = form

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (save.isPending) return
      setFormMessage(null)
      try {
        const saved = await save.mutateAsync({ id: company?._id, input: toInput(values, isEdit) })
        notify.success(isEdit ? "Company saved" : "Company added", { description: saved.name })
        onSaved(saved)
      } catch (error) {
        if ((error as { code?: string })?.code === "COMPANY_TYPE_IN_USE") {
          form.setError("type", {
            type: "server",
            message:
              'This company already has records of that kind, so it can\'t drop that role. Choose "Supplier & buyer" instead.',
          })
        } else {
          const { formMessage } = applyServerErrors(error, form.setError, ORDER, {
            fieldMap: {
              normalizedName: "name",
              "contact.person": "person",
              "contact.phone": "phone",
              "contact.email": "email",
            },
            duplicateMessages: {
              name: "A company with this name already exists. Search for it in the list, or use a different name.",
              gstNumber: "Another company already has this GST number.",
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
      title={isEdit ? `Edit ${company!.name}` : "New company"}
      description={isEdit ? undefined : "A supplier you buy from, a buyer you sell to, or both."}
      isDirty={formState.isDirty && !formState.isSubmitSuccessful}
      recordName="company"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <FormSheetCancel />
          <Button
            type="submit"
            form="company-form"
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
              "Add company"
            )}
          </Button>
        </div>
      }
    >
      <form id="company-form" onSubmit={onSubmit} noValidate>
        <ErrorSummary errors={summary} focusKey={focusKey} />
        <FieldGroup className="gap-6">
          <FieldSet className="gap-4">
            <FieldLegend>Who</FieldLegend>
            <FormField control={control} name="name" label="Company name">
              {(field, props) => (
                <Input
                  {...field}
                  {...props}
                  autoComplete="organization"
                  className="h-11 md:h-9"
                  autoFocus={!isEdit}
                />
              )}
            </FormField>

            <Controller
              control={control}
              name="type"
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid} className="gap-2">
                  <FieldLegend variant="label">What do you do with them?</FieldLegend>
                  <RadioGroup
                    value={field.value || null}
                    onValueChange={(v) => field.onChange(v)}
                    aria-invalid={fieldState.invalid}
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {(Object.keys(COMPANY_TYPES) as CompanyType[]).map((type, i) => {
                      const t = COMPANY_TYPES[type]
                      const id = i === 0 ? fieldId("type") : `${fieldId("type")}-${type}`
                      return (
                        <FieldLabel key={type} htmlFor={id} className="cursor-pointer">
                          <Field orientation="horizontal" className="items-start">
                            <FieldContent>
                              <FieldTitle>
                                <t.icon className="size-4 text-muted-foreground" /> {t.label}
                              </FieldTitle>
                              <FieldDescription className="text-xs">{t.description}</FieldDescription>
                            </FieldContent>
                            <RadioGroupItem
                              value={type}
                              id={id}
                              aria-label={`${t.label}: ${t.description}`}
                              aria-invalid={fieldState.invalid}
                            />
                          </Field>
                        </FieldLabel>
                      )
                    })}
                  </RadioGroup>
                  {fieldState.error?.message ? (
                    <p className="flex items-start gap-1.5 text-sm text-destructive">
                      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {fieldState.error.message}
                    </p>
                  ) : null}
                </FieldSet>
              )}
            />

            <FormField
              control={control}
              name="gstNumber"
              label="GST number"
              optional
              description="15 characters, like 24AAACA1234A1Z5"
            >
              {(field, props) => (
                <Input
                  {...field}
                  {...props}
                  maxLength={20}
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-11 font-mono uppercase md:h-9 md:max-w-56"
                  onBlur={() => {
                    // Soft mask: tidy on blur, and check the format once the user has finished.
                    const tidy = normalizeGst(field.value)
                    if (tidy !== field.value) form.setValue("gstNumber", tidy, { shouldDirty: true })
                    field.onBlur()
                    if (tidy) void form.trigger("gstNumber")
                  }}
                />
              )}
            </FormField>
          </FieldSet>

          <FieldSet className="gap-4">
            <FieldLegend>Contact</FieldLegend>
            <FormField control={control} name="person" label="Contact person" optional>
              {(field, props) => <Input {...field} {...props} autoComplete="name" className="h-11 md:h-9" />}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={control} name="phone" label="Phone" optional>
                {(field, props) => (
                  <Input
                    {...field}
                    {...props}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-11 md:h-9"
                  />
                )}
              </FormField>
              <FormField control={control} name="email" label="Email" optional>
                {(field, props) => (
                  <Input
                    {...field}
                    {...props}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    className="h-11 md:h-9"
                  />
                )}
              </FormField>
            </div>
            <FormField control={control} name="address" label="Address" optional>
              {(field, props) => <Textarea {...field} {...props} rows={3} autoComplete="street-address" />}
            </FormField>
          </FieldSet>

          {isEdit ? (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor={fieldId("isActive")}>Active</FieldLabel>
                    <FieldDescription className="text-xs">
                      Inactive companies stay in past records but can&apos;t be picked for new purchases,
                      orders or deliveries.
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
