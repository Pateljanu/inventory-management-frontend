import { describe, expect, it } from "vitest"
import { rateSpread } from "./spread"

describe("rateSpread", () => {
  it("is selling minus buying, and that as a share of buying", () => {
    expect(rateSpread("50.000", "28500.00", "40.000", "33500.00")).toEqual({
      amount: "5000.00",
      percent: 17.54,
      tone: "good",
    })
  })

  it("is negative when selling below buying", () => {
    expect(rateSpread("10", "40000", "5", "38000")).toEqual({ amount: "-2000.00", percent: -5, tone: "bad" })
  })

  it("is neutral when the rates match", () => {
    expect(rateSpread("10", "30000", "5", "30000")).toMatchObject({
      amount: "0.00",
      percent: 0,
      tone: "neutral",
    })
  })

  it("is null without both a purchase and a sale", () => {
    expect(rateSpread("0.000", "0.00", "5", "30000")).toBeNull()
    expect(rateSpread("5", "30000", "0.000", "0.00")).toBeNull()
  })

  it("is null when the buying rate is zero", () => {
    expect(rateSpread("5", "0.00", "5", "30000")).toBeNull()
  })
})
