import { describe, expect, it } from "vitest"
import { buyerActivity, supplierStock } from "./company-wise"
import type { CompanyTotalRow, SalesPO, SourceStockRow } from "@/types/api"

const pool = (company: string, material: string, available: string): SourceStockRow => ({
  sourceCompanyId: company,
  sourceCompanyName: company.toUpperCase(),
  materialId: material,
  materialName: material.toUpperCase(),
  purchasedTons: available,
  usedForSalesTons: "0.000",
  availableTons: available,
})
const total = (company: string, tons: string, value: string): CompanyTotalRow => ({
  companyId: company,
  companyName: company.toUpperCase(),
  quantityTons: tons,
  value,
  averageRate: "0.00",
})
const order = (company: string, left: string) =>
  ({ companyId: { _id: company, name: company.toUpperCase() }, remainingQuantityTons: left }) as SalesPO

describe("supplierStock", () => {
  it("adds each supplier's materials up, most stock first, and skips used-up pools", () => {
    const rows = supplierStock(
      [pool("a", "ms", "10"), pool("b", "ms", "30"), pool("a", "brass", "25"), pool("c", "ms", "0.000")],
      [total("a", "35", "100000"), total("d", "5", "9000")]
    )
    expect(rows.map((r) => [r.name, r.availableTons])).toEqual([
      ["A", "35.000"],
      ["B", "30.000"],
      // Bought in the period but nothing left: still listed, after those holding stock.
      ["D", "0.000"],
    ])
    expect(rows[0].materials.map((m) => [m.name, m.availableTons])).toEqual([
      ["BRASS", "25.000"],
      ["MS", "10.000"],
    ])
    expect(rows[0].bought).toEqual({ tons: "35.000", value: "100000" })
    expect(rows[1].bought).toBeNull()
  })
})

describe("buyerActivity", () => {
  it("joins deliveries in the period with open orders now", () => {
    const rows = buyerActivity(
      [total("x", "20", "81000")],
      [order("x", "50"), order("y", "30"), order("y", "20")]
    )
    expect(rows).toEqual([
      {
        companyId: "x",
        name: "X",
        delivered: { tons: "20.000", value: "81000", averageRate: "0.00" },
        open: { count: 1, leftTons: "50.000" },
      },
      { companyId: "y", name: "Y", delivered: null, open: { count: 2, leftTons: "50.000" } },
    ])
  })

  it("leaves open orders unknown for a past period", () => {
    expect(buyerActivity([total("x", "20", "81000")], undefined)[0].open).toBeNull()
  })
})
