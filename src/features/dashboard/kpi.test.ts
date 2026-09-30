import { describe, expect, it } from "vitest"
import { moneyDelta, stockDelta } from "./kpi"

describe("moneyDelta", () => {
  it("gives the percent change with the earlier amount", () => {
    expect(moneyDelta("19640000", "18200000", "vs Aug")).toEqual({
      trend: "up",
      tone: "good",
      text: "8% vs Aug (₹1.82 Cr)",
    })
    expect(moneyDelta("900000", "1000000", "vs Aug")).toMatchObject({
      trend: "down",
      tone: "bad",
      text: "10% vs Aug (₹10 L)",
    })
  })

  it("handles no change and an empty earlier period", () => {
    expect(moneyDelta("0.00", "0.00", "vs Aug")).toEqual({
      trend: "flat",
      tone: "neutral",
      text: "No change vs Aug",
    })
    expect(moneyDelta("5000.00", "0.00", "vs Aug")).toMatchObject({ trend: "up", text: "from ₹0 vs Aug" })
  })
})

describe("stockDelta", () => {
  it("is bought minus delivered since the start of the period", () => {
    expect(stockDelta("412.380", "380.860", "2026-09-01")).toEqual({
      trend: "up",
      tone: "neutral",
      text: "31.520 t since 01/09/2026",
    })
    expect(stockDelta("10", "12.5", "2026-09-01")).toMatchObject({
      trend: "down",
      text: "2.500 t since 01/09/2026",
    })
    expect(stockDelta("3", "3", "2026-09-01").trend).toBe("flat")
  })
})
