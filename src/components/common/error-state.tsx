import { RotateCw, TriangleAlert, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { isApiError } from "@/lib/api-client"
import { errorMessage, errorReference } from "@/lib/errors"
import { cn } from "@/lib/utils"

type ErrorStateProps = {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** Page or section error: plain words, "Try again", and a reference only for server faults. */
export function ErrorState({ error, title, onRetry, retrying, className }: ErrorStateProps) {
  const offline = isApiError(error) && error.code === "NETWORK_ERROR"
  const reference = errorReference(error)
  const Icon = offline ? WifiOff : TriangleAlert
  return (
    <Empty className={cn("border py-12", className)} role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/12 text-destructive">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">
          {title ?? (offline ? "Can't reach the server" : "This couldn't be loaded")}
        </EmptyTitle>
        <EmptyDescription>{errorMessage(error)}</EmptyDescription>
        {reference ? (
          <p className="text-xs text-muted-foreground">
            Reference: <span className="font-mono select-all">{reference}</span>
          </p>
        ) : null}
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RotateCw className={cn(retrying && "animate-spin")} />
            Try again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
