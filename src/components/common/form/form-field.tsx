import type { ReactNode } from "react"
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import { CircleAlert } from "lucide-react"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { fieldId } from "@/lib/form-errors"

type ControlProps = {
  id: string
  "aria-invalid": boolean
  "aria-describedby"?: string
}

type FormFieldProps<TValues extends FieldValues, TName extends FieldPath<TValues>> = {
  control: Control<TValues>
  name: TName
  label: ReactNode
  /** Most fields are required, so only optional ones are marked. */
  optional?: boolean
  description?: ReactNode
  className?: string
  children: (
    field: ControllerRenderProps<TValues, TName>,
    controlProps: ControlProps,
    fieldState: ControllerFieldState
  ) => ReactNode
}

/** Label on top, control, helper text, and the error linked to the control via aria-describedby. */
export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  control,
  name,
  label,
  optional,
  description,
  className,
  children,
}: FormFieldProps<TValues, TName>) {
  const id = fieldId(name)
  const descId = `${id}-desc`
  const errorId = `${id}-error`

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy = [description ? descId : null, fieldState.error ? errorId : null]
          .filter(Boolean)
          .join(" ")
        return (
          <Field data-invalid={fieldState.invalid} className={cn("gap-2", className)}>
            <FieldLabel htmlFor={id}>
              {label}
              {optional ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
            </FieldLabel>
            {children(
              field,
              { id, "aria-invalid": fieldState.invalid, "aria-describedby": describedBy || undefined },
              fieldState
            )}
            {description ? (
              <FieldDescription id={descId} className="-mt-0.5 text-xs">
                {description}
              </FieldDescription>
            ) : null}
            {fieldState.error?.message ? (
              <p id={errorId} className="flex items-start gap-1.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {fieldState.error.message}
              </p>
            ) : null}
          </Field>
        )
      }}
    />
  )
}
