import { useCallback, useEffect, useRef, useState } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { useSession } from "@/features/auth/session"
import { clearDraft, readDraft, writeDraft, type Draft } from "@/lib/drafts"

/** Typing is written to storage this long after the last change. */
const SAVE_DELAY_MS = 400

type DraftOptions = {
  /** Storage slot: "purchase", "delivery", "sales-order". */
  name: string
  /** What the form was opened for ("new", "order:<id>"): a draft only comes back to the same kind. */
  context: string
  /** Off for edits; drafts are for new records only. */
  enabled: boolean
}

export type FormDraft<T> = {
  /** The entry that was brought back when the form opened, until it is saved or discarded. */
  restored: Draft<T> | null
  /** Forget the draft (after a save, or when the user leaves on purpose). */
  clear: () => void
  /** Forget the draft and empty the form back to its defaults. */
  discard: () => void
}

/**
 * Keeps a new record's unsaved entries on this device while the user types, and brings them
 * back the next time the same form opens. A form restored this way counts as having unsaved
 * changes, so closing it still asks first.
 */
export function useFormDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  { name, context, enabled }: DraftOptions
): FormDraft<T> {
  const userId = useSession().user?.id
  const active = enabled && Boolean(userId)
  const [restored, setRestored] = useState(() => (active ? readDraft<T>(userId!, name, context) : null))
  const timer = useRef<number | undefined>(undefined)
  const applied = useRef(false)

  // On top of the defaults (not instead of them), so the form is dirty and "Start over" can reset.
  useEffect(() => {
    if (!restored || applied.current) return
    applied.current = true
    form.reset(restored.values, { keepDefaultValues: true })
  }, [restored, form])

  useEffect(() => {
    if (!active) return
    const unsubscribe = form.subscribe({
      formState: { values: true, isDirty: true },
      callback: ({ values, isDirty }) => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          if (isDirty) writeDraft(userId!, name, context, values)
          else clearDraft(userId!, name)
        }, SAVE_DELAY_MS)
      },
    })
    return () => {
      window.clearTimeout(timer.current)
      unsubscribe()
    }
  }, [active, form, userId, name, context])

  const clear = useCallback(() => {
    window.clearTimeout(timer.current)
    if (userId) clearDraft(userId, name)
    setRestored(null)
  }, [userId, name])

  const discard = useCallback(() => {
    clear()
    form.reset()
  }, [clear, form])

  return { restored, clear, discard }
}
