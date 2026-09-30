import { describe, expect, it } from "vitest"
import {
  assessLimits,
  limitKindFromCode,
  limitLabel,
  overLimitMessage,
  sourceDateProblem,
  typedTons,
} from "./limits"
import type { SaleCapacity } from "@/types/api"

// The design spec's example: PO-0142 has 11.750 t left, 71.500 t in the yard, 9.200 t from the supplier.
const capacity: SaleCapacity = {
  poId: "p",
  poNumber: "PO-0142",
  poDate: "2026-09-05",
  poOpen: true,
  materialId: "m",
  saleDate: "2026-09-27",
  remainingQuantityTons: "11.750",
  availableStockTons: "71.500",
  availableSourceStockTons: "9.200",
  maxAllowedTons: "9.200",
  limitedBy: "SOURCE_STOCK",
  sources: [],
}

describe("assessLimits", () => {
  it("is neutral with nothing typed and marks the binding limit", () => {
    const a = assessLimits(capacity, "")
    expect(a.level).toBe("empty")
    expect(a.max).toBe("9.200")
    expect(a.spare).toBeNull()
    expect(a.rows.map((r) => [r.kind, r.value, r.binding, r.fill])).toEqual([
      ["PO", "11.750", false, 0],
      ["STOCK", "71.500", false, 0],
      ["SOURCE_STOCK", "9.200", true, 0],
    ])
  })

  it("previews what is left after the typed tons", () => {
    const a = assessLimits(capacity, "6")
    expect(a.level).toBe("ok")
    expect(a.spare).toBe("3.200")
    expect(a.rows.map((r) => r.after)).toEqual(["5.750", "65.500", "3.200"])
  })

  it("warns from 80% of the maximum and flags over the limit", () => {
    expect(assessLimits(capacity, "7.359").level).toBe("ok")
    expect(assessLimits(capacity, "7.36").level).toBe("near")
    expect(assessLimits(capacity, "9.199").level).toBe("near")
    // Exactly the maximum is allowed and is the usual default, so it is not a warning.
    expect(assessLimits(capacity, "9.2").level).toBe("full")
    const over = assessLimits(capacity, "10")
    expect(over.level).toBe("over")
    expect(over.spare).toBe("-0.800")
    expect(over.rows.find((r) => r.kind === "SOURCE_STOCK")).toMatchObject({ level: "over", fill: 100 })
    expect(over.rows.find((r) => r.kind === "PO")).toMatchObject({ level: "near" })
  })

  it("treats any tons as over when nothing can be delivered", () => {
    const none = { ...capacity, availableSourceStockTons: "0.000", maxAllowedTons: "0.000" }
    const a = assessLimits(none, "0.5")
    expect(a.level).toBe("over")
    expect(a.rows.find((r) => r.kind === "SOURCE_STOCK")?.fill).toBe(100)
  })

  it("has two rows until a supplier is chosen", () => {
    const noSource = {
      ...capacity,
      availableSourceStockTons: null,
      maxAllowedTons: "11.750",
      limitedBy: "PO" as const,
    }
    const a = assessLimits(noSource, "")
    expect(a.rows.map((r) => r.kind)).toEqual(["PO", "STOCK"])
    expect(a.rows[0].binding).toBe(true)
  })
})

describe("typedTons", () => {
  it("accepts positive decimals only", () => {
    expect(typedTons("12.450")).toBe("12.450")
    expect(typedTons("")).toBeNull()
    expect(typedTons("0")).toBeNull()
    expect(typedTons("abc")).toBeNull()
  })
})

describe("limit copy", () => {
  const names = { poNumber: "PO-0142", material: "HMS 1", source: "Shree Ganesh Metals" }

  it("names the limits in trade words", () => {
    expect(limitLabel("PO", names)).toBe("Left on PO-0142")
    expect(limitLabel("STOCK", names)).toBe("HMS 1 in yard")
    expect(limitLabel("SOURCE_STOCK", names)).toBe("Shree Ganesh Metals stock")
  })

  it("says how much is left and what to enter", () => {
    expect(overLimitMessage("SOURCE_STOCK", "9.200", names)).toBe(
      "Only 9.200 t of HMS 1 from Shree Ganesh Metals is left. Enter 9.200 t or less, or choose another supplier."
    )
    expect(overLimitMessage("PO", "11.750", names)).toBe(
      "PO-0142 has only 11.750 t left to deliver. Enter 11.750 t or less."
    )
    expect(overLimitMessage("STOCK", "0.000", names)).toBe("There is no HMS 1 free in the yard on this date.")
  })

  it("says when the supplier's stock only arrives after the delivery date", () => {
    const later = { ...names, saleDate: "2026-09-10", sourceFirstPurchaseDate: "2026-09-15" }
    expect(sourceDateProblem(later)).toEqual({
      field: "saleDate",
      message:
        "Shree Ganesh Metals first sold you HMS 1 on 15/09/2026. Choose that date or later, or another supplier.",
    })
    expect(overLimitMessage("SOURCE_STOCK", "0.000", later)).toBe(sourceDateProblem(later)!.message)
    // With some stock left the quantity is the fix, not the date.
    expect(overLimitMessage("SOURCE_STOCK", "2.000", later)).toMatch(/^Only 2.000 t/)
  })

  it("says when the supplier never sold you the material", () => {
    const never = { ...names, saleDate: "2026-09-10", sourceFirstPurchaseDate: null }
    expect(sourceDateProblem(never)).toEqual({
      field: "source",
      message: "You haven't bought any HMS 1 from Shree Ganesh Metals. Choose another supplier.",
    })
  })

  it("has no date problem on or after the first purchase, or when it isn't known", () => {
    expect(
      sourceDateProblem({ ...names, saleDate: "2026-09-15", sourceFirstPurchaseDate: "2026-09-15" })
    ).toBeNull()
    expect(sourceDateProblem({ ...names, saleDate: "2026-09-10" })).toBeNull()
    expect(overLimitMessage("SOURCE_STOCK", "0.000", names)).toBe(
      "Shree Ganesh Metals has no HMS 1 left on this date. Choose another supplier."
    )
  })

  it("maps the server's 409 codes to limits", () => {
    expect(limitKindFromCode("INSUFFICIENT_SOURCE_STOCK")).toBe("SOURCE_STOCK")
    expect(limitKindFromCode("PO_QUANTITY_EXCEEDED")).toBe("PO")
    expect(limitKindFromCode("DUPLICATE_VALUE")).toBeNull()
  })
})
