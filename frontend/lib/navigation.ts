import {
  Boxes,
  ChartColumn,
  LayoutDashboard,
  Pill,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Tags,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/api/types";
import { ALL_ROLES } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const STOCK_ROLES: readonly Role[] = ["ADMIN", "INVENTORY_MANAGER"];
const ADMIN_ROLES: readonly Role[] = ["ADMIN"];

/**
 * Navigation is cosmetic: the API enforces every permission. Roles here only
 * decide which links are worth showing.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/medicines", label: "Medicines", icon: Pill, roles: ALL_ROLES },
      { href: "/categories", label: "Categories", icon: Tags, roles: ALL_ROLES },
      { href: "/suppliers", label: "Suppliers", icon: Truck, roles: ALL_ROLES },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/purchases",
        label: "Purchases",
        icon: ShoppingCart,
        roles: STOCK_ROLES,
      },
      { href: "/inventory", label: "Inventory", icon: Boxes, roles: ALL_ROLES },
      { href: "/sales", label: "Sales", icon: ReceiptText, roles: ALL_ROLES },
      { href: "/alerts", label: "Alerts", icon: TriangleAlert, roles: ALL_ROLES },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/reports",
        label: "Reports",
        icon: ChartColumn,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        href: "/audit-logs",
        label: "Audit log",
        icon: ScrollText,
        roles: ADMIN_ROLES,
      },
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        roles: ADMIN_ROLES,
      },
    ],
  },
];

export function navGroupsFor(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_GROUPS.flatMap((group) => group.items).find(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
