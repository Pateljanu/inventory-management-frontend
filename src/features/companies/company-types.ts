import { ArrowDownToLine, ArrowLeftRight, Truck, type LucideIcon } from "lucide-react"
import type { CompanyType } from "@/types/api"

/** Trade words for the backend's company types. */
export const COMPANY_TYPES: Record<CompanyType, { label: string; description: string; icon: LucideIcon }> = {
  PURCHASE: { label: "Supplier", description: "You buy scrap from them", icon: ArrowDownToLine },
  SALE: { label: "Buyer", description: "They send you orders", icon: Truck },
  BOTH: {
    label: "Supplier & buyer",
    description: "You buy from them and sell to them",
    icon: ArrowLeftRight,
  },
}

export const COMPANY_TYPE_OPTIONS = (Object.keys(COMPANY_TYPES) as CompanyType[]).map((value) => ({
  value,
  label: COMPANY_TYPES[value].label,
}))

/** Suppliers (and "both") are the stock sources deliveries draw from. */
export const isSupplier = (type: CompanyType) => type === "PURCHASE" || type === "BOTH"
