import { describe, expect, it } from "vitest"
import { comparisonRange, fyLabel, matchPreset, resolvePreset } from "./fy"
import { addDays, businessToday, isDateOnly } from "./dates"

const TODAY = "2026-09-27" // a Sunday

describe("resolvePreset", () => {
  it.each([
    ["today", "2026-09-27", "2026-09-27"],
    ["yesterday", "2026-09-26", "2026-09-26"],
    ["this-week", "2026-09-21", "2026-09-27"],
    ["this-month", "2026-09-01", "2026-09-30"],
    ["last-month", "2026-08-01", "2026-08-31"],
    ["this-quarter", "2026-07-01", "2026-09-30"],
    ["this-fy", "2026-04-01", "2027-03-31"],
    ["last-fy", "2025-04-01", "2026-03-31"],
  ] as const)("%s", (id, from, to) => {
    expect(resolvePreset(id, TODAY)).toEqual({ from, to })
  })

  it("starts the FY in the previous year during January-March", () => {
    expect(resolvePreset("this-fy", "2027-02-10")).toEqual({ from: "2026-04-01", to: "2027-03-31" })
    expect(resolvePreset("this-quarter", "2027-02-10")).toEqual({ from: "2027-01-01", to: "2027-03-31" })
    expect(fyLabel("2027-02-10")).toBe("FY 2026-27")
  })

  it("handles January for last month and leap years", () => {
    expect(resolvePreset("last-month", "2027-01-15")).toEqual({ from: "2026-12-01", to: "2026-12-31" })
    expect(resolvePreset("this-month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" })
  })

  it("can clamp the end to today for reports", () => {
    expect(resolvePreset("this-month", TODAY, { clampToToday: true })).toEqual({
      from: "2026-09-01",
      to: TODAY,
    })
  })

  it("recognises a preset from its range", () => {
    expect(matchPreset({ from: "2026-04-01", to: "2027-03-31" }, TODAY)).toBe("this-fy")
    expect(matchPreset({ from: "2026-04-02", to: "2027-03-31" }, TODAY)).toBeNull()
  })
})

describe("dates", () => {
  it("computes today in India, not UTC", () => {
    // 20:00 UTC on 26 Sep is 01:30 on 27 Sep in India.
    expect(businessToday(new Date("2026-09-26T20:00:00Z"), "Asia/Kolkata")).toBe("2026-09-27")
  })
  it("validates calendar dates", () => {
    expect(isDateOnly("2026-02-30")).toBe(false)
    expect(isDateOnly("2028-02-29")).toBe(true)
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })
})

describe("comparisonRange", () => {
  it.each([
    // Month to date → same days last month.
    ["2026-09-01", "2026-09-27", "2026-08-01", "2026-08-27", "vs Aug"],
    // A full month whose predecessor is shorter is clamped.
    ["2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28", "vs Feb"],
    ["2027-01-01", "2027-01-15", "2026-12-01", "2026-12-15", "vs Dec"],
    // FY to date → same dates last FY.
    ["2026-04-01", "2026-09-27", "2025-04-01", "2025-09-27", "vs FY 2025-26"],
    // Quarter to date → last quarter's same days.
    ["2026-07-01", "2026-09-27", "2026-04-01", "2026-06-27", "vs last quarter"],
    // Single day, week, and anything else → the same length just before.
    ["2026-09-27", "2026-09-27", "2026-09-26", "2026-09-26", "vs the day before"],
    ["2026-09-21", "2026-09-27", "2026-09-14", "2026-09-20", "vs last week"],
    ["2026-09-10", "2026-09-19", "2026-08-31", "2026-09-09", "vs previous 10 days"],
  ] as const)("%s – %s", (from, to, cFrom, cTo, label) => {
    expect(comparisonRange({ from, to })).toEqual({ range: { from: cFrom, to: cTo }, label })
  })
})
