import type { Role } from "@/lib/api/types";

export const ALL_ROLES: readonly Role[] = [
  "ADMIN",
  "PHARMACIST",
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
