import { useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Eye, EyeOff, LockKeyhole, TriangleAlert } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { login, logout, useSession } from "./session"
import { errorMessage } from "@/lib/errors"

/**
 * When the session ends while the app is open, ask for the password right here instead of
 * leaving the page: an open form keeps everything typed, and the user carries on with Save.
 */
export function SessionExpiredDialog() {
  const { status, user } = useSession()
  const open = status === "expired" && Boolean(user)

  return (
    // Can't be dismissed: the only ways out are logging in again or switching user.
    <Dialog open={open} onOpenChange={() => undefined} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        {open && user ? <ReloginForm email={user.email} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ReloginForm({ email }: { email: string }) {
  const queryClient = useQueryClient()
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    if (!password) {
      setError("Enter your password")
      return
    }
    setPending(true)
    setError(null)
    try {
      await login(email, password)
      // Anything that failed while logged out loads again.
      void queryClient.invalidateQueries()
    } catch (err) {
      setError(errorMessage(err))
      setPassword("")
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-busy={pending}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" /> Log in again to continue
        </DialogTitle>
        <DialogDescription>
          You were logged out after a while, for safety. Everything on this page, including anything you
          typed, is still here.
        </DialogDescription>
      </DialogHeader>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm">
        <span className="text-muted-foreground">Account </span>
        <span className="font-medium break-all">{email}</span>
      </p>
      {/* Lets password managers match the saved login. */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />

      <Field className="gap-2">
        <FieldLabel htmlFor="relogin-password">Password</FieldLabel>
        <InputGroup className="h-11 md:h-9">
          <InputGroupInput
            id="relogin-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-base md:text-sm"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>

      <div className="flex flex-col gap-2">
        <Button type="submit" className="h-11 w-full md:h-9" aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Logging in…
            </>
          ) : (
            "Log in and continue"
          )}
        </Button>
        <Button type="button" variant="ghost" className="h-11 w-full md:h-9" onClick={() => void logout()}>
          Log in as someone else
        </Button>
      </div>
    </form>
  )
}
