import { beforeEach, describe, expect, it } from "vitest"
import { DRAFT_MAX_AGE_MS, clearDraft, readDraft, writeDraft } from "./drafts"

describe("drafts", () => {
  beforeEach(() => localStorage.clear())

  it("brings a draft back to the same user, form and context only", () => {
    writeDraft("u1", "purchase", "new", { tons: "12.5" }, 1000)
    expect(readDraft("u1", "purchase", "new", 2000)).toEqual({
      context: "new",
      savedAt: 1000,
      values: { tons: "12.5" },
    })
    expect(readDraft("u1", "purchase", "material:m1", 2000)).toBeNull()
    expect(readDraft("u2", "purchase", "new", 2000)).toBeNull()
    expect(readDraft("u1", "delivery", "new", 2000)).toBeNull()
  })

  it("keeps one slot per form: a newer draft replaces the older one", () => {
    writeDraft("u1", "delivery", "order:a", { tons: "1" }, 1000)
    writeDraft("u1", "delivery", "new", { tons: "2" }, 2000)
    expect(readDraft("u1", "delivery", "order:a", 3000)).toBeNull()
    expect(readDraft("u1", "delivery", "new", 3000)?.values).toEqual({ tons: "2" })
  })

  it("forgets drafts older than a week and cleared drafts", () => {
    writeDraft("u1", "purchase", "new", { tons: "1" }, 0)
    expect(readDraft("u1", "purchase", "new", DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(localStorage.length).toBe(0)

    writeDraft("u1", "purchase", "new", { tons: "1" }, 0)
    clearDraft("u1", "purchase")
    expect(readDraft("u1", "purchase", "new", 1)).toBeNull()
  })

  it("ignores unreadable storage", () => {
    localStorage.setItem("metalix.draft.u1.purchase", "{not json")
    expect(readDraft("u1", "purchase", "new")).toBeNull()
  })
})
