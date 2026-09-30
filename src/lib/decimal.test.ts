import { describe, expect, it } from "vitest"
import { amountFrom, minOf, percentOf, toBig } from "./decimal"
import { safeRedirect } from "./redirect"
import { can } from "./permissions"

describe("decimal", () => {
  it("multiplies tons by rate exactly and rounds half-up to paise", () => {
    expect(amountFrom("12.450", "34500")).toBe("429525.00")
    expect(amountFrom("0.1", "0.2")).toBe("0.02")
    expect(amountFrom("1.005", "1")).toBe("1.01")
  })
  it("treats blank or invalid input as zero", () => {
    expect(toBig("").toString()).toBe("0")
    expect(toBig("abc").toString()).toBe("0")
  })
  it("finds the binding limit", () => {
    expect(minOf("11.750", "9.2", "65.5").toFixed(3)).toBe("9.200")
  })
  it("computes percentages safely", () => {
    expect(percentOf("18.25", "30")).toBe(60.8)
    expect(percentOf("1", "0")).toBe(0)
  })
})

describe("safeRedirect", () => {
  it("allows only in-app paths", () => {
    expect(safeRedirect("/purchases?from=2026-09-01")).toBe("/purchases?from=2026-09-01")
    expect(safeRedirect("https://evil.example")).toBe("/")
    expect(safeRedirect("//evil.example")).toBe("/")
    expect(safeRedirect("/login?redirect=/x")).toBe("/")
    expect(safeRedirect(undefined)).toBe("/")
  })
})

describe("permissions", () => {
  it("lets owners write and viewers only read", () => {
    expect(can({ role: "OWNER" }, "write")).toBe(true)
    expect(can({ role: "VIEWER" }, "write")).toBe(false)
    expect(can({ role: "VIEWER" }, "read")).toBe(true)
    expect(can(null, "read")).toBe(false)
  })
})
