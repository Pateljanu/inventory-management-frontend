import { describe, expect, it } from "vitest"
import { dashboardPeriod } from "./period"

const TODAY = "2026-09-27"

describe("dashboardPeriod", () => {
  it("defaults to this month so far", () => {
    expect(dashboardPeriod({}, TODAY)).toEqual({
      from: "2026-09-01",
      to: "2026-09-27",
      preset: "this-month",
      words: "this month",
      endsToday: true,
    })
  })

  it("recognises presets and clamps future ends to today", () => {
    expect(dashboardPeriod({ from: "2026-04-01", to: "2027-03-31" }, TODAY)).toMatchObject({
      to: "2026-09-27",
      preset: "this-fy",
      words: "this FY",
    })
  })

  it("keeps a custom past range and says so", () => {
    expect(dashboardPeriod({ from: "2026-08-10", to: "2026-08-20" }, TODAY)).toEqual({
      from: "2026-08-10",
      to: "2026-08-20",
      preset: null,
      words: "in this period",
      endsToday: false,
    })
  })

  it("ignores a reversed range", () => {
    expect(dashboardPeriod({ from: "2026-09-20", to: "2026-09-10" }, TODAY).preset).toBe("this-month")
  })
})
