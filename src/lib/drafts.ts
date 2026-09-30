/*
 * Unsaved form entries kept on this device, so a reload, a closed tab or a dropped yard
 * connection never loses a half-typed purchase or delivery. One slot per form and signed-in
 * user; a draft is offered back only to the same kind of form ("new", or "order:<id>") and is
 * forgotten after a week.
 */

const PREFIX = "metalix.draft."
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type Draft<T> = { context: string; savedAt: number; values: T }

const keyOf = (userId: string, form: string) => `${PREFIX}${userId}.${form}`

export function readDraft<T>(
  userId: string,
  form: string,
  context: string,
  now = Date.now()
): Draft<T> | null {
  try {
    const raw = localStorage.getItem(keyOf(userId, form))
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft<T>
    if (typeof draft?.savedAt !== "number" || !draft.values || now - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(keyOf(userId, form))
      return null
    }
    return draft.context === context ? draft : null
  } catch {
    return null
  }
}

export function writeDraft<T>(userId: string, form: string, context: string, values: T, now = Date.now()) {
  try {
    const draft: Draft<T> = { context, savedAt: now, values }
    localStorage.setItem(keyOf(userId, form), JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the form still works, it just isn't kept.
  }
}

export function clearDraft(userId: string, form: string) {
  try {
    localStorage.removeItem(keyOf(userId, form))
  } catch {
    // Nothing to clear.
  }
}
