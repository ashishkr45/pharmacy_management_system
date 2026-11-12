export const ROLES = ["ADMIN", "PHARMACIST", "INVENTORY_MANAGER"] as const;

export type Role = (typeof ROLES)[number];

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** List endpoints return `{ data, meta }`; single resources return `{ data }`. */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface Category {
  id: number;
  name: string;
  medicineCount: number;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Medicine {
  id: number;
  name: string;
  genericName: string | null;
  sku: string;
  categoryId: number;
  unit: string;
  reorderLevel: number;
  taxRate: string | null;
  defaultSalePrice: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: {
    id: number;
    name: string;
  };
}

export interface PurchaseItem {
  id: number;
  medicineId: number;
  batchId: number;
  quantity: number;
  costPrice: string;
  salePrice: string;
  expiryDate: string;
  medicine: {
    id: number;
    name: string;
    sku: string;
  };
  batch: {
    id: number;
    batchNo: string;
    expiryDate: string;
    quantityOnHand: number;
  };
}

export interface Purchase {
  id: number;
  supplierId: number;
  supplierInvoiceNo: string;
  purchaseDate: string;
  totalCost: string;
  createdById: number;
  createdAt: string;
  supplier: {
    id: number;
    name: string;
  };
  createdBy: {
    id: number;
    name: string;
  };
  items: PurchaseItem[];
}

export interface Batch {
  id: number;
  medicineId: number;
  batchNo: string;
  expiryDate: string;
  quantityOnHand: number;
  purchasePrice: string;
  salePrice: string;
  supplierId: number | null;
  createdAt: string;
  updatedAt: string;
  medicine: {
    id: number;
    name: string;
    sku: string;
    unit: string;
    reorderLevel: number;
  };
  supplier: {
    id: number;
    name: string;
  } | null;
  daysUntilExpiry: number;
  expired: boolean;
}

export interface ExpiryAlertItem {
  batchId: number;
  batchNo: string;
  expiryDate: string;
  quantityOnHand: number;
  daysUntilExpiry: number;
  expired: boolean;
  medicine: {
    id: number;
    name: string;
    sku: string;
    unit: string;
    reorderLevel: number;
  };
}

export interface LowStockItem {
  medicineId: number;
  name: string;
  sku: string;
  unit: string;
  reorderLevel: number;
  availableQuantity: number;
  expiredQuantity: number;
  shortfall: number;
}

export const STOCK_MOVEMENT_TYPES = [
  "OPENING",
  "PURCHASE",
  "SALE",
  "RETURN",
  "ADJUSTMENT",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovement {
  id: number;
  batchId: number;
  type: StockMovementType;
  qtyDelta: number;
  referenceType: string;
  referenceId: number | null;
  reason: string | null;
  createdById: number | null;
  createdAt: string;
  batch: {
    id: number;
    batchNo: string;
    medicine: {
      id: number;
      name: string;
      sku: string;
    };
  };
  createdBy: {
    id: number;
    name: string;
  } | null;
}

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INSUFFICIENT_STOCK",
  "BATCH_EXPIRED",
  "INVALID_STATE",
  "IDEMPOTENCY_CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
