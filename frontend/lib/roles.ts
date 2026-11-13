import type { Role } from "@/lib/api/types";

export const ALL_ROLES: readonly Role[] = [
  "ADMIN",
  "PHARMACIST",
  "INVENTORY_MANAGER",
];

/** Catalogue writes are ADMIN / INVENTORY_MANAGER only (server-enforced). */
export const CATALOGUE_WRITE_ROLES: readonly Role[] = [
  "ADMIN",
  "INVENTORY_MANAGER",
];

/** Purchases receive stock and are ADMIN / INVENTORY_MANAGER only. */
export const PURCHASE_WRITE_ROLES: readonly Role[] = [
  "ADMIN",
  "INVENTORY_MANAGER",
];

/** Sales create invoices and are ADMIN / PHARMACIST only. */
export const SALE_WRITE_ROLES: readonly Role[] = ["ADMIN", "PHARMACIST"];

/** Returns are part of the sales counter flow. */
export const RETURN_WRITE_ROLES: readonly Role[] = SALE_WRITE_ROLES;

/** Stock adjustments are a stock-control action, like catalogue writes. */
export const ADJUSTMENT_WRITE_ROLES: readonly Role[] = [
  "ADMIN",
  "INVENTORY_MANAGER",
];

/** The sales report contains revenue and is limited to counter roles. */
export const SALES_REPORT_ROLES: readonly Role[] = ["ADMIN", "PHARMACIST"];

/** Stock, expiry and reconciliation reports belong to the stock roles. */
export const STOCK_REPORT_ROLES: readonly Role[] = [
  "ADMIN",
  "INVENTORY_MANAGER",
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  PHARMACIST: "Pharmacist",
  INVENTORY_MANAGER: "Inventory manager",
};

export function canAccess(
  role: Role | undefined,
  allowed: readonly Role[],
): boolean {
  return role !== undefined && allowed.includes(role);
}
