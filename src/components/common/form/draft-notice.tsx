import { History } from "lucide-react"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatRelative } from "@/lib/format"

/** Tells the user that what they typed earlier was brought back, with a way to start over. */
export function DraftNotice({ savedAt, onDiscard }: { savedAt: number | null; onDiscard: () => void }) {
  if (savedAt === null) return null
  return (
    <Alert role="status" className="mb-5 border-primary/30 bg-accent/40 pr-28">
      <History aria-hidden="true" />
      <AlertTitle>Your unsaved entry is back</AlertTitle>
      <AlertDescription>
        Typed {formatRelative(savedAt)} ({formatDateTime(new Date(savedAt).toISOString())}). Check it and
        save.
      </AlertDescription>
      <AlertAction className="top-1/2 -translate-y-1/2">
        <Button type="button" size="sm" variant="outline" className="pointer-coarse:h-10" onClick={onDiscard}>
          Start over
        </Button>
      </AlertAction>
    </Alert>
  )
}
