import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form"
import { isApiError } from "./api-client"
import { errorMessage } from "./errors"

/*
 * Puts server-side problems where the user will see them:
 *  - 422 VALIDATION_ERROR issues ("body.contact.email") go under the matching field,
 *  - 409 DUPLICATE_VALUE (details.fields: ["normalizedName"]) goes under the field the caller maps,
 *  - anything else becomes one form-level message.
 */

type Options<T extends FieldValues> = {
  /** Server path (without "body.") or unique-index field -> form field. */
  fieldMap?: Record<string, Path<T>>
  /** Messages for duplicates, per form field ("A company with this name already exists"). */
  duplicateMessages?: Partial<Record<Path<T>, string>>
  /** Codes the screen explains in its own words. */
  codeMessages?: Record<string, string>
}

export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  known: readonly Path<T>[],
  opts: Options<T> = {}
): { formMessage: string | null } {
  if (!isApiError(error)) return { formMessage: errorMessage(error) }

  const resolve = (serverPath: string): Path<T> | undefined => {
    const path = serverPath.replace(/^body\./, "")
    const mapped = opts.fieldMap?.[path]
    if (mapped) return mapped
    return known.includes(path as Path<T>) ? (path as Path<T>) : undefined
  }

  if (error.code === "VALIDATION_ERROR" && error.issues.length) {
    const unplaced: string[] = []
    for (const issue of error.issues) {
      const field = resolve(issue.path)
      if (field) setError(field, { type: "server", message: issue.message })
      else unplaced.push(issue.message)
    }
    return { formMessage: unplaced.length ? unplaced.join(". ") : null }
  }

  if (error.code === "DUPLICATE_VALUE") {
    const fields = ((error.details?.fields as string[] | undefined) ?? [])
      .map(resolve)
      .filter((f): f is Path<T> => Boolean(f))
    // Compound keys (supplier + invoice no.) belong on the field the screen explains, not on every part.
    const explained = fields.filter((f) => opts.duplicateMessages?.[f])
    const targets = explained.length ? explained : fields
    for (const field of targets) {
      setError(field, { type: "server", message: opts.duplicateMessages?.[field] ?? errorMessage(error) })
    }
    if (targets.length) return { formMessage: null }
  }

  return { formMessage: opts.codeMessages?.[error.code] ?? errorMessage(error) }
}

/** Field ids are the field path with dots replaced, so the error summary can link to them. */
export const fieldId = (name: string) => `field-${name.replace(/\./g, "-")}`

/** Flattens RHF errors into summary rows in the order of `order`. */
export function collectErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  order: readonly Path<T>[]
): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = []
  for (const path of order) {
    const err = path
      .split(".")
      .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], errors) as
      { message?: string } | undefined
    if (err?.message) out.push({ field: fieldId(path), message: err.message })
  }
  return out
}
