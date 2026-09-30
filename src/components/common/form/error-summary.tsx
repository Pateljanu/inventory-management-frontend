import { useEffect, useRef } from "react"
import { CircleAlert } from "lucide-react"

export type SummaryError = { field?: string; message: string }

/**
 * "There is a problem" box at the top of a form after a failed save. It takes focus so screen
 * reader and keyboard users land on it, and each item links to its field. The wording is
 * identical to the message under the field.
 */
export function ErrorSummary({ errors, focusKey }: { errors: SummaryError[]; focusKey: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (errors.length && focusKey) ref.current?.focus()
    // Refocus on every failed submit, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey])

  if (!errors.length) return null

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="mb-5 rounded-lg border-2 border-destructive/60 bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
    >
      <h2 id="error-summary-title" className="flex items-center gap-2 font-semibold text-destructive">
        <CircleAlert className="size-4" /> There is a problem
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {errors.map((e, i) => (
          <li key={`${e.field ?? "form"}-${i}`}>
            {e.field ? (
              <a
                href={`#${e.field}`}
                className="text-destructive underline underline-offset-2"
                onClick={(event) => {
                  const el = document.getElementById(e.field!)
                  if (!el) return
                  event.preventDefault()
                  el.focus()
                  el.scrollIntoView({ block: "center" })
                }}
              >
                {e.message}
              </a>
            ) : (
              <span className="text-destructive">{e.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
