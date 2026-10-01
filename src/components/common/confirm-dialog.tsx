/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react"
import { TriangleAlert } from "lucide-react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { errorMessage } from "@/lib/errors"

export type ConfirmOptions = {
  title: string
  description?: ReactNode
  /** Verb that says what happens: "Deactivate", "Leave". Never "OK" or "Yes". */
  confirmLabel: string
  /** The safe choice: "Keep active", "Stay on page". Gets initial focus. */
  cancelLabel?: string
  destructive?: boolean
  /** Runs inside the dialog: shows "…" while pending and keeps the dialog open on failure. */
  onConfirm?: () => Promise<unknown>
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

/** `const ok = await confirm({...})` from anywhere below the provider. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setError(null)
        setBusy(false)
        setCurrent({ ...opts, resolve })
      }),
    []
  )

  const close = (ok: boolean) => {
    current?.resolve(ok)
    setCurrent(null)
  }

  const onConfirm = async () => {
    if (!current) return
    if (!current.onConfirm) return close(true)
    setBusy(true)
    setError(null)
    try {
      await current.onConfirm()
      close(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(current)} onOpenChange={(open) => !open && !busy && close(false)}>
        <AlertDialogContent initialFocus={cancelRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>{current?.title}</AlertDialogTitle>
            {current?.description ? (
              <AlertDialogDescription render={<div />}>{current.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          {error ? (
            <p role="alert" className="flex gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              ref={cancelRef}
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => close(false)}
              disabled={busy}
            >
              {current?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={current?.destructive ? "destructive" : "default"}
              className="h-11 sm:h-9"
              onClick={onConfirm}
              aria-busy={busy}
            >
              {busy ? <Spinner /> : null}
              {current?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx
}
