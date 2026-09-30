/*
 * Shapes returned by the Metal Scrap API (/api/v1). Decimal values (tons, rates, money) are
 * always exact strings such as "30.250"; dates are ISO strings, and business dates are UTC
 * midnight ("2026-09-27T00:00:00.000Z").
 */

export type Decimal = string
export type IsoDate = string

export type Role = "OWNER" | "VIEWER"

export type User = {
  id: string
  email: string
  name?: string
  role: Role
}

export type PageMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type Paginated<T> = { items: T[]; meta: PageMeta }

export type ApiErrorBody = {
  code: string
  message: string
  details?: Record<string, unknown> & { issues?: { path: string; message: string }[] }
  requestId?: string
}

export type LoginResponse = {
  accessToken: string
  refreshToken: string
  tokenType: "Bearer"
  expiresIn: string
  user: User
}

export type RefreshResponse = Omit<LoginResponse, "user">

export type CompanyType = "PURCHASE" | "SALE" | "BOTH"

/** A populated reference ({ _id, name }) as returned by list/detail endpoints. */
export type Ref = { _id: string; name: string }

/**
 * What POST/PATCH return for a purchase, sales order or delivery: the stored document, so references are plain
 * ids and computed order fields (delivered, left, status) are missing. Use form values for display.
 */
export type Saved<T> = Omit<
  T,
  | "companyId"
  | "materialId"
  | "poId"
  | "sourceCompanyId"
  | "soldQuantityTons"
  | "remainingQuantityTons"
  | "displayStatus"
> & { companyId: string; materialId: string } & (T extends { poId: unknown }
    ? { poId: string; sourceCompanyId: string }
    : unknown)

export type Company = {
  _id: string
  name: string
  type: CompanyType
  contact?: { person?: string; phone?: string; email?: string }
  address?: string
  gstNumber?: string
  isActive: boolean
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type Material = {
  _id: string
  name: string
  openingStockTons: Decimal
  notes?: string
  isActive: boolean
  /** Only on GET /materials/:id. */
  currentStockTons?: Decimal
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type Purchase = {
  _id: string
  purchaseDate: IsoDate
  companyId: Ref
  materialId: Ref
  quantityTons: Decimal
  ratePerTon: Decimal
  totalAmount: Decimal
  vehicleNumber?: string
  invoiceNumber?: string
  notes?: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type POLifecycle = "ACTIVE" | "CANCELLED"
export type PODisplayStatus = "PENDING" | "PARTIALLY_SUPPLIED" | "COMPLETED" | "CANCELLED"

export type SalesPO = {
  _id: string
  poNumber: string
  poDate: IsoDate
  companyId: Ref
  materialId: Ref
  quantityTons: Decimal
  ratePerTon: Decimal
  totalPOAmount: Decimal
  lifecycleStatus: POLifecycle
  soldQuantityTons: Decimal
  remainingQuantityTons: Decimal
  displayStatus: PODisplayStatus
  notes?: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type Sale = {
  _id: string
  saleDate: IsoDate
  poId: { _id: string; poNumber: string }
  companyId: Ref
  sourceCompanyId: Ref & { type?: CompanyType }
  materialId: Ref
  quantityTons: Decimal
  poRateAtSale: Decimal
  totalAmount: Decimal
  vehicleNumber?: string
  challanNumber?: string
  notes?: string
  createdAt: IsoDate
  updatedAt: IsoDate
}

export type LimitKind = "PO" | "STOCK" | "SOURCE_STOCK"

/** GET /sales/capacity: the three limits on a delivery, before it is saved. */
export type SaleCapacity = {
  poId: string
  poNumber: string
  poDate: string
  poOpen: boolean
  materialId: string
  saleDate: string
  remainingQuantityTons: Decimal
  /** Yard stock that is free on the sale date and every later day. */
  availableStockTons: Decimal
  /** Same for the chosen supplier's stock; null when no supplier is chosen. */
  availableSourceStockTons: Decimal | null
  maxAllowedTons: Decimal
  limitedBy: LimitKind
  /** Suppliers holding this material, most stock first. */
  sources: SaleSource[]
}

/** One supplier's stock of the order's material, as seen from the delivery date. */
export type SaleSource = {
  sourceCompanyId: string
  name: string
  isActive: boolean
  /** Free for a delivery on the sale date (headroom: later deliveries are already held back). */
  availableTons: Decimal
  /** Bought from them up to the sale date. */
  purchasedTons: Decimal
  /** Already delivered from their stock up to the sale date. */
  usedTons: Decimal
  /** Their first purchase of this material ever; null if never bought. */
  firstPurchaseDate: string | null
  /** Their latest purchase on or before the sale date; null if none yet. */
  lastPurchaseDate: string | null
}

export type DashboardMaterialRow = {
  materialId: string
  materialName: string
  currentStockTons: Decimal
  remainingPOQuantityTons: Decimal
  purchaseRequiredTons: Decimal
  extraStockTons: Decimal
  purchasedTons: Decimal
  purchaseValue: Decimal
  averageBuyingRate: Decimal
  soldTons: Decimal
  salesValue: Decimal
  averageSellingRate: Decimal
}

export type Dashboard = {
  period: { from: string | null; to: string }
  purchases: { quantityTons: Decimal; value: Decimal; averageBuyingRate: Decimal }
  sales: { quantityTons: Decimal; value: Decimal; averageSellingRate: Decimal }
  po: {
    poQuantityTons: Decimal
    deliveredQuantityTons: Decimal
    remainingQuantityTons: Decimal
    activePOCount: number
    openPOCount: number
  }
  materials: DashboardMaterialRow[]
  /** Period activity per company: bought from each supplier, delivered to each buyer; biggest value first. */
  companies: { suppliers: CompanyTotalRow[]; buyers: CompanyTotalRow[] }
}

export type CompanyTotalRow = {
  companyId: string
  companyName: string | null
  quantityTons: Decimal
  value: Decimal
  averageRate: Decimal
}

export type SourceStockRow = {
  sourceCompanyId: string
  sourceCompanyName: string | null
  materialId: string
  materialName: string | null
  purchasedTons: Decimal
  usedForSalesTons: Decimal
  availableTons: Decimal
}

export type CompanySummary = Dashboard & {
  company: { _id: string; name: string; type: CompanyType; isActive: boolean }
  sourceStock: SourceStockRow[]
}

export type TrendBucket = "day" | "week" | "month"

/** GET /reports/trend: bought vs delivered per bucket; empty buckets included. */
export type Trend = {
  from: string
  to: string
  bucket: TrendBucket
  points: {
    start: string
    end: string
    purchasedTons: Decimal
    purchaseValue: Decimal
    deliveredTons: Decimal
    salesValue: Decimal
  }[]
}
