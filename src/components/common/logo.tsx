import { cn } from "@/lib/utils"

/** The "M" mark: primary-filled rounded square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground",
        className
      )}
    >
      M
    </span>
  )
}
