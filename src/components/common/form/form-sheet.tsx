import { createContext, useContext, useEffect, type KeyboardEvent, type ReactNode } from "react"
import { useBlocker } from "@tanstack/react-router"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useConfirm } from "@/components/common/confirm-dialog"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type FormSheetProps = {
  open: boolean
  /** Called with false once closing is allowed (after the unsaved-changes check). */
  onClose: () => void
  title: string
  description?: ReactNode
  /** Unsaved edits: closing or leaving the page asks first. */
  isDirty: boolean
  /** Word used in "Your changes to this … will be lost". */
  recordName: string
  /** The <form>; its footer goes in `footer`. */
  children: ReactNode
  footer: ReactNode
  size?: "default" | "wide"
  /** The user chose to leave with unsaved changes (e.g. forget the form's draft). */
  onDiscard?: () => void
}

/** Closing that asks first when there are unsaved changes (same as ✕, Esc and the overlay). */
const RequestCloseContext = createContext<() => void>(() => {})

/** The footer's Cancel button. It goes through the unsaved-changes check like ✕ does. */
export function FormSheetCancel({ className }: { className?: string }) {
  const requestClose = useContext(RequestCloseContext)
  return (
    <Button type="button" variant="outline" className={cn("h-11 sm:h-9", className)} onClick={requestClose}>
      Cancel
    </Button>
  )
}

/** "Ctrl ↵" inside a primary Save button, on devices with a keyboard and mouse. */
export function SaveKeyHint() {
  return (
    <Kbd
      aria-hidden="true"
      className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground pointer-fine:sm:inline-flex"
    >
      Ctrl ↵
    </Kbd>
  )
}

const TYPING_INPUTS = new Set(["text", "search", "tel", "email", "url", "number", "password"])

/**
 * Enter moves to the next field, as in Tally, instead of saving half a form. Open pickers keep
 * Enter for choosing; buttons, text areas and Ctrl+Enter behave as usual. Enter in the last
 * field saves.
 */
function moveToNextField(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  const input = event.target
  if (!(input instanceof HTMLInputElement) || !TYPING_INPUTS.has(input.type) || !input.form) return
  if (input.getAttribute("aria-expanded") === "true") return

  const fields = Array.from(
    input.form.querySelectorAll<HTMLElement>("input, select, textarea, button[aria-haspopup=dialog]")
  ).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLInputElement).disabled &&
      !(el as HTMLInputElement).readOnly &&
      (el as HTMLInputElement).type !== "hidden" &&
      el.getClientRects().length > 0
  )
  event.preventDefault()
  const next = fields[fields.indexOf(input) + 1]
  if (next) next.focus()
  else input.form.requestSubmit()
}

/**
 * Create/edit container: a right-hand sheet on desktop (560 px, 768 px when wide) and a full
 * height bottom sheet on phones, with a sticky footer. It never loses typed data silently:
 * closing, Esc, the browser Back button and tab close all warn while the form is dirty.
 */
export function FormSheet({
  open,
  onClose,
  title,
  description,
  isDirty,
  recordName,
  children,
  footer,
  size = "default",
  onDiscard,
}: FormSheetProps) {
  const isMobile = useIsMobile()
  const confirm = useConfirm()

  const askToLeave = async () => {
    const leave = await confirm({
      title: "Leave without saving?",
      description: `Your changes to this ${recordName} will be lost.`,
      cancelLabel: "Stay on page",
      confirmLabel: "Leave",
      destructive: true,
    })
    if (leave) onDiscard?.()
    return leave
  }

  const requestClose = async () => {
    if (!isDirty || (await askToLeave())) onClose()
  }

  // Leaving the page (not just closing the sheet, which only changes the search params).
  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (!open || !isDirty || current.pathname === next.pathname) return false
      return !(await askToLeave())
    },
    enableBeforeUnload: open && isDirty,
  })

  // Ctrl+S / Ctrl+Enter save from any field of this sheet (not from a dialog opened over it).
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const save =
        (event.ctrlKey || event.metaKey) && (event.key === "Enter" || event.key.toLowerCase() === "s")
      if (!save) return
      const sheet = (event.target as Element | null)?.closest?.("[data-slot=form-sheet]")
      const form = sheet?.querySelector<HTMLFormElement>("form")
      if (!form) return
      event.preventDefault()
      form.requestSubmit()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <RequestCloseContext value={() => void requestClose()}>
      <Sheet open={open} onOpenChange={(next) => !next && void requestClose()}>
        <SheetContent
          data-slot="form-sheet"
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "gap-0 p-0",
            // Same variant prefixes as the vendored defaults (h-auto; w-3/4, sm:max-w-sm) so these win.
            isMobile
              ? "rounded-t-2xl data-[side=bottom]:h-[96dvh]"
              : "data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]",
            !isMobile && size === "wide" && "data-[side=right]:sm:max-w-[768px]"
          )}
        >
          <SheetHeader className="border-b px-5 py-4 pr-12">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-5"
            onKeyDown={moveToNextField}
          >
            {children}
          </div>
          <SheetFooter className="border-t bg-background px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </RequestCloseContext>
  )
}
