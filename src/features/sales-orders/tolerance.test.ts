import { describe, expect, it } from "vitest"
import { maxDeliverable, settledShortBy } from "./tolerance"
import type { SalesPO } from "@/types/api"

describe("maxDeliverable", () => {
  it("adds the tolerance to the ordered tons", () => {
    expect(maxDeliverable("30", "5")).toBe("31.500")
    expect(maxDeliverable("28.5", "10")).toBe("31.350")
  })

  it("rounds down, never past what the percentage allows", () => {
    expect(maxDeliverable("10.333", "5")).toBe("10.849")
  })

  it("treats a missing tolerance as none", () => {
    expect(maxDeliverable("30", undefined)).toBe("30.000")
    expect(maxDeliverable("30", "")).toBe("30.000")
  })
})

describe("settledShortBy", () => {
  const po = (quantityTons: string, originalQuantityTons?: string) =>
    ({ quantityTons, originalQuantityTons }) as SalesPO

  it("is the tons a settle took off", () => {
    expect(settledShortBy(po("28.000", "30.000"))).toBe("2.000")
  })

  it("is null for orders never settled or edited back up", () => {
    expect(settledShortBy(po("30.000"))).toBeNull()
    expect(settledShortBy(po("30.000", "30.000"))).toBeNull()
  })
})
