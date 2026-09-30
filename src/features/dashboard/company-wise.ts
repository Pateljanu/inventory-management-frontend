import { isPositive, plus, qty, toBig } from "@/lib/decimal"
import type { CompanyTotalRow, SalesPO, SourceStockRow } from "@/types/api"

/*
 * The dashboard's company-wise panels: stock held per supplier and period activity per buyer.
 * Pure, so the grouping and ordering are unit-tested.
 */

export type SupplierStock = {
  companyId: string
  name: string
  /** Bought from them and not yet delivered, all materials. */
  availableTons: string
  /** Their stock per material, most first; materials with nothing left are left out. */
  materials: { materialId: string; name: string; availableTons: string }[]
  /** Bought from them in the period; null when nothing was. */
  bought: { tons: string; value: string } | null
}

/**
 * One row per supplier that holds stock or sold to you in the period, most stock first (then
 * most bought). `pools` are supplier × material stock as of the period end.
 */
export function supplierStock(pools: SourceStockRow[], suppliers: CompanyTotalRow[]): SupplierStock[] {
  const rows = new Map<string, SupplierStock>()
  const row = (companyId: string, name: string | null) => {
    if (!rows.has(companyId)) {
      rows.set(companyId, {
        companyId,
        name: name ?? "Unknown supplier",
        availableTons: "0.000",
        materials: [],
        bought: null,
      })
    }
    return rows.get(companyId)!
  }
  for (const p of pools) {
    if (!isPositive(p.availableTons)) continue
    const r = row(p.sourceCompanyId, p.sourceCompanyName)
    r.availableTons = qty(plus(r.availableTons, p.availableTons))
    r.materials.push({
      materialId: p.materialId,
      name: p.materialName ?? "Unknown material",
      availableTons: qty(p.availableTons),
    })
  }
  for (const s of suppliers) {
    if (!isPositive(s.quantityTons)) continue
    row(s.companyId, s.companyName).bought = { tons: qty(s.quantityTons), value: s.value }
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      materials: r.materials.sort((a, b) => toBig(b.availableTons).cmp(toBig(a.availableTons))),
    }))
    .sort(
      (a, b) =>
        toBig(b.availableTons).cmp(toBig(a.availableTons)) ||
        toBig(b.bought?.value ?? 0).cmp(toBig(a.bought?.value ?? 0)) ||
        a.name.localeCompare(b.name)
    )
}

export type BuyerActivity = {
  companyId: string
  name: string
  /** Delivered to them in the period; null when nothing was. */
  delivered: { tons: string; value: string; averageRate: string } | null
  /** Their open orders now; null when open orders aren't known (a past period). */
  open: { count: number; leftTons: string } | null
}

/**
 * One row per buyer with deliveries in the period or (when known) open orders, biggest delivered
 * value first, then most left to deliver.
 */
export function buyerActivity(buyers: CompanyTotalRow[], openOrders: SalesPO[] | undefined): BuyerActivity[] {
  const rows = new Map<string, BuyerActivity>()
  const row = (companyId: string, name: string | null) => {
    if (!rows.has(companyId)) {
      rows.set(companyId, {
        companyId,
        name: name ?? "Unknown buyer",
        delivered: null,
        open: openOrders ? { count: 0, leftTons: "0.000" } : null,
      })
    }
    return rows.get(companyId)!
  }
  for (const b of buyers) {
    if (!isPositive(b.quantityTons)) continue
    row(b.companyId, b.companyName).delivered = {
      tons: qty(b.quantityTons),
      value: b.value,
      averageRate: b.averageRate,
    }
  }
  for (const o of openOrders ?? []) {
    if (!isPositive(o.remainingQuantityTons)) continue
    const r = row(o.companyId._id, o.companyId.name)
    r.open = { count: r.open!.count + 1, leftTons: qty(plus(r.open!.leftTons, o.remainingQuantityTons)) }
  }
  return [...rows.values()].sort(
    (a, b) =>
      toBig(b.delivered?.value ?? 0).cmp(toBig(a.delivered?.value ?? 0)) ||
      toBig(b.open?.leftTons ?? 0).cmp(toBig(a.open?.leftTons ?? 0)) ||
      a.name.localeCompare(b.name)
  )
}
