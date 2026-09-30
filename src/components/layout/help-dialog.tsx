import { Fragment, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useShell } from "./shell-context"
import { useSession } from "@/features/auth/session"
import { can } from "@/lib/permissions"

type Shortcut = { keys: string[][]; action: string; writeOnly?: boolean }

/** Each entry lists alternatives; each alternative is keys pressed together. */
const SHORTCUTS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Anywhere",
    items: [
      { keys: [["Ctrl", "K"]], action: "Search or jump to a page" },
      { keys: [["Alt", "P"], ["F9"]], action: "New purchase", writeOnly: true },
      { keys: [["Alt", "O"]], action: "New sales order", writeOnly: true },
      { keys: [["Alt", "D"], ["F8"]], action: "Record a delivery", writeOnly: true },
      { keys: [["Ctrl", "B"]], action: "Hide or show the side menu" },
      { keys: [["?"]], action: "Open this list" },
    ],
  },
  {
    title: "Lists",
    items: [{ keys: [["/"]], action: "Jump to the search box" }],
  },
  {
    title: "Forms",
    items: [
      { keys: [["Enter"]], action: "Go to the next field" },
      {
        keys: [
          ["Ctrl", "Enter"],
          ["Ctrl", "S"],
        ],
        action: "Save",
        writeOnly: true,
      },
      {
        keys: [["Alt", "C"]],
        action: "In a supplier, buyer or material box: add a new one",
        writeOnly: true,
      },
      { keys: [["Esc"]], action: "Close the form (asks first if you typed something)" },
    ],
  },
]

const TIPS = [
  "Every number on the dashboard opens the records behind it.",
  "New purchases, orders and deliveries keep what you type on this device. If the page closes before you save, it comes back the next time you open the form.",
  "Working outdoors? Turn on Sunlight mode in the account menu for stronger contrast.",
]

/** "Help & shortcuts": short tips plus every keyboard shortcut. Opens with "?" from anywhere. */
export function HelpDialog() {
  const { helpOpen, setHelpOpen } = useShell()
  const { user } = useSession()
  const canWrite = can(user, "write")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const question = event.key === "?" || (event.code === "Slash" && event.shiftKey)
      if (!question || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return
      event.preventDefault()
      setHelpOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setHelpOpen])

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Help &amp; shortcuts</DialogTitle>
          <DialogDescription>Tips for daily work, and keys that save clicks on a computer.</DialogDescription>
        </DialogHeader>

        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        {SHORTCUTS.map((group) => {
          const items = group.items.filter((s) => canWrite || !s.writeOnly)
          return (
            <section
              key={group.title}
              aria-labelledby={`keys-${group.title}`}
              className="flex flex-col gap-1"
            >
              <h3 id={`keys-${group.title}`} className="text-xs font-medium text-muted-foreground">
                {group.title}
              </h3>
              <dl className="divide-y">
                {items.map((s) => (
                  <div key={s.action} className="flex items-center justify-between gap-4 py-2">
                    <dt className="text-sm">{s.action}</dt>
                    <dd className="flex shrink-0 items-center gap-1.5">
                      {s.keys.map((combo, i) => (
                        <Fragment key={combo.join("+")}>
                          {i > 0 ? <span className="text-xs text-muted-foreground">or</span> : null}
                          <KbdGroup aria-label={combo.join(" + ")}>
                            {combo.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </KbdGroup>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}
      </DialogContent>
    </Dialog>
  )
}
