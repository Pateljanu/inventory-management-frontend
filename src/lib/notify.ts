import type { ReactNode } from "react"
import { toast } from "sonner"
import { TOAST_DURATION, TOAST_DURATION_WITH_ACTION } from "./timing"

/*
 * The only way the app shows toasts. Feature code never imports sonner directly, so a later
 * switch to Base UI Toast is a change to this file alone.
 */
type Action = { label: string; onClick: () => void }
type Options = { description?: ReactNode; action?: Action; id?: string | number }

function show(kind: "success" | "error" | "info" | "warning", title: string, opts: Options = {}) {
  return toast[kind](title, {
    id: opts.id,
    description: opts.description,
    action: opts.action,
    duration: opts.action ? TOAST_DURATION_WITH_ACTION : TOAST_DURATION,
    closeButton: Boolean(opts.action),
  })
}

export const notify = {
  success: (title: string, opts?: Options) => show("success", title, opts),
  error: (title: string, opts?: Options) => show("error", title, opts),
  info: (title: string, opts?: Options) => show("info", title, opts),
  warning: (title: string, opts?: Options) => show("warning", title, opts),
  dismiss: (id?: string | number) => toast.dismiss(id),
}
