import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { login } from "./session"
import { errorMessage } from "@/lib/errors"
import type { User } from "@/types/api"

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .pipe(z.email("Enter an email address like name@example.com")),
  password: z.string().min(1, "Enter your password"),
})
type Values = z.infer<typeof schema>

export function LoginForm({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    // Validate on submit, then re-check as the user fixes each field.
    mode: "onSubmit",
    reValidateMode: "onChange",
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      onSuccess(await login(values.email, values.password))
    } catch (error) {
      setServerError(errorMessage(error))
      form.setValue("password", "")
      form.setFocus("password")
    }
  })

  const submitting = form.formState.isSubmitting

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={submitting}>
      <FieldGroup className="gap-5">
        {serverError ? (
          <Alert variant="destructive" role="alert">
            <TriangleAlert />
            <AlertTitle>Couldn&apos;t log in</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                className="h-10 md:h-9"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "email-error" : undefined}
              />
              <FieldError id="email-error" errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <InputGroup className="h-10 md:h-9">
                <InputGroupInput
                  {...field}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={fieldState.error ? "password-error" : undefined}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError id="password-error" errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Button type="submit" className="h-10 w-full md:h-9" aria-disabled={submitting}>
          {submitting ? (
            <>
              <Spinner /> Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </FieldGroup>
    </form>
  )
}
