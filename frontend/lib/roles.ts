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
