import {
  ArrowDownToLine,
  Building2,
  ClipboardList,
  FileBarChart,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react"

/*
 * One navigation model for the sidebar, the phone bottom bar, the "More" sheet and the
 * command palette. Groups are ordered by how often people use them; masters come last.
 */

export type AppPath =
  | "/"
  | "/purchases"
  | "/sales-orders"
  | "/deliveries"
  | "/supplier-stock"
  | "/company-report"
  | "/rate-analysis"
  | "/companies"
  | "/materials"

export type NavItem = {
  id: string
  title: string
  to: AppPath
  icon: LucideIcon
  /** Words the command palette also matches. */
  keywords?: string[]
}

export type NavGroup = { label: string; items: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", title: "Dashboard", to: "/", icon: LayoutDashboard, keywords: ["home", "kpi"] },
    ],
  },
  {
    label: "Daily work",
    items: [
      {
        id: "purchases",
        title: "Purchases",
        to: "/purchases",
        icon: ArrowDownToLine,
        keywords: ["buy", "inward"],
      },
      {
        id: "sales-orders",
        title: "Sales Orders",
        to: "/sales-orders",
        icon: ClipboardList,
        keywords: ["po", "order", "buyer"],
      },
      {
        id: "deliveries",
        title: "Deliveries",
        to: "/deliveries",
        icon: Truck,
        keywords: ["sale", "dispatch", "challan"],
      },
    ],
  },
  {
    label: "Stock & reports",
    items: [
      {
        id: "supplier-stock",
        title: "Supplier stock",
        to: "/supplier-stock",
        icon: Warehouse,
        keywords: ["source", "stock with supplier"],
      },
      {
        id: "company-report",
        title: "Company report",
        to: "/company-report",
        icon: FileBarChart,
        keywords: ["party", "ledger", "summary"],
      },
      {
        id: "rate-analysis",
        title: "Rate analysis",
        to: "/rate-analysis",
        icon: IndianRupee,
        keywords: ["average", "avg rate", "price", "margin", "spread"],
      },
    ],
  },
  {
    label: "Setup",
    items: [
      {
        id: "companies",
        title: "Companies",
        to: "/companies",
        icon: Building2,
        keywords: ["party", "supplier", "buyer"],
      },
      {
        id: "materials",
        title: "Materials",
        to: "/materials",
        icon: Layers,
        keywords: ["item", "scrap", "grade"],
      },
    ],
  },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

export const navItem = (id: string) => NAV_ITEMS.find((i) => i.id === id)!

/** Create actions (OWNER only), shared by "+ New", the phone "New" drawer and the palette. */
export type CreateAction = {
  id: "purchase" | "sales-order" | "delivery" | "company" | "material"
  title: string
  description: string
  to: AppPath
  shortcut?: string
  icon: LucideIcon
}

export const CREATE_ACTIONS: CreateAction[] = [
  {
    id: "purchase",
    title: "Purchase",
    description: "Scrap coming in from a supplier",
    to: "/purchases",
    shortcut: "Alt+P",
    icon: ArrowDownToLine,
  },
  {
    id: "delivery",
    title: "Delivery",
    description: "Scrap going out against an order",
    to: "/deliveries",
    shortcut: "Alt+D",
    icon: Truck,
  },
  {
    id: "sales-order",
    title: "Sales order",
    description: "A new order from a buyer",
    to: "/sales-orders",
    shortcut: "Alt+O",
    icon: ClipboardList,
  },
  {
    id: "company",
    title: "Company",
    description: "A supplier or buyer",
    to: "/companies",
    icon: Building2,
  },
  {
    id: "material",
    title: "Material",
    description: "A scrap grade you trade",
    to: "/materials",
    icon: Layers,
  },
]

/** Where a create action goes: its list page, with the create sheet open (?create=true). */
export const createTarget = (action: CreateAction) => ({ to: action.to, search: { create: true } }) as const
