import { describe, expect, it } from "vitest"
import {
  formatCount,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatRate,
  formatTons,
  formatTonsCompact,
} from "./format"

describe("formatTons", () => {
  it("uses Indian grouping and 3 decimals", () => {
    expect(formatTons("1284.5")).toBe("1,284.500")
    expect(formatTons("123456.789")).toBe("1,23,456.789")
    expect(formatTons("12.45", { unit: true })).toBe("12.450 t")
  })
  it("keeps exact string values (no float drift)", () => {
    expect(formatTons("0.1")).toBe("0.100")
    expect(formatTons("99999999999.999")).toBe("99,99,99,99,999.999")
  })
  it("uses a true minus and never prints negative zero", () => {
    expect(formatTons("-2.3")).toBe("−2.300")
    expect(formatTons("-0.0001")).toBe("0.000")
  })
  it("shows a dash for missing values but a real zero for zero", () => {
    expect(formatTons(null)).toBe("—")
    expect(formatTons("0")).toBe("0.000")
  })
  it("rounds half-up", () => {
    expect(formatTons("1.0005")).toBe("1.001")
  })
})

describe("formatMoney / formatRate", () => {
  it("formats rupees with lakh grouping", () => {
    expect(formatMoney("1187894.21")).toBe("₹11,87,894.21")
    expect(formatMoney("1187894.21", { symbol: false })).toBe("11,87,894.21")
    expect(formatMoney("-500")).toBe("−₹500.00")
  })
  it("formats rates per ton", () => {
    expect(formatRate("38500")).toBe("₹38,500.00/t")
  })
})

describe("formatMoneyCompact", () => {
  it.each([
    ["87500", "₹87,500"],
    ["875000", "₹8.75 L"],
    ["1250000", "₹12.5 L"],
    ["9999999", "₹1 Cr"],
    ["19600000", "₹1.96 Cr"],
    ["2450000000", "₹245 Cr"],
    ["12450000000", "₹1,245 Cr"],
    ["1190000000", "₹119 Cr"],
    ["-1250000", "−₹12.5 L"],
  ])("%s -> %s", (input, expected) => {
    expect(formatMoneyCompact(input)).toBe(expected)
  })
  it("never produces the broken built-in 'KCr' output", () => {
    expect(formatMoneyCompact("1190000000")).not.toMatch(/K/)
  })
})

describe("other formatters", () => {
  it("formats compact tons for tiles", () => {
    expect(formatTonsCompact("286.45")).toBe("286.5 t")
  })
  it("formats business dates as DD/MM/YYYY without time-zone shifts", () => {
    expect(formatDate("2026-09-27T00:00:00.000Z")).toBe("27/09/2026")
    expect(formatDate("2026-04-01")).toBe("01/04/2026")
    expect(formatDate(null)).toBe("—")
  })
  it("formats counts and percents", () => {
    expect(formatCount(124500)).toBe("1,24,500")
    expect(formatPercent(60.8)).toBe("61%")
  })
})
