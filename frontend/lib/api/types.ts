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

export interface AlertCounts {
  lowStock: number;
  nearExpiry: number;
  expired: number;
}

export const PAYMENT_METHODS = ["CASH", "CARD", "UPI"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_STATUSES = [
  "COMPLETED",
  "PARTIALLY_RETURNED",
  "FULLY_RETURNED",
] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export interface SaleItem {
  id: number;
  medicineId: number;
  batchId: number;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  returnedQuantity: number;
  medicine: {
    id: number;
    name: string;
    sku: string;
    unit: string;
  };
  batch: {
    id: number;
    batchNo: string;
    expiryDate: string;
  };
}

export interface Sale {
  id: number;
  invoiceNo: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: PaymentMethod;
  subtotal: string;
  taxTotal: string;
  total: string;
  status: SaleStatus;
  createdAt: string;
  createdById: number;
  createdBy: {
    id: number;
    name: string;
  };
  items: SaleItem[];
}

/** The invoice endpoint returns the sale plus its pricing convention. */
export interface InvoiceSale extends Sale {
  taxInclusive?: boolean;
}

export interface SaleReturnRecord {
  id: number;
  saleItemId: number;
  quantity: number;
  reason: string;
  createdById: number;
  createdAt: string;
  createdBy: {
    id: number;
    name: string;
  };
  saleItem: {
    id: number;
    saleId: number;
    medicineId: number;
    batchId: number;
    quantity: number;
    returnedQuantity: number;
    unitPrice: string;
    taxAmount: string;
    lineTotal: string;
    medicine: {
      id: number;
      name: string;
      sku: string;
      unit: string;
    };
    batch: {
      id: number;
      batchNo: string;
      expiryDate: string;
    };
    sale: {
      id: number;
      invoiceNo: string;
      status: SaleStatus;
    };
  };
}

export interface CreateSaleReturnResult {
  saleId: number;
  invoiceNo: string;
  status: SaleStatus;
  returns: SaleReturnRecord[];
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

export const ADJUSTMENT_REASONS = [
  "DAMAGED",
  "EXPIRED",
  "COUNT_CORRECTION",
  "LOST",
  "OTHER",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export interface Adjustment {
  id: number;
  batchId: number;
  delta: number;
  reasonCode: AdjustmentReason;
  note: string | null;
  createdById: number;
  createdAt: string;
  batch: {
    id: number;
    batchNo: string;
    expiryDate: string;
    quantityOnHand: number;
    medicine: {
      id: number;
      name: string;
      sku: string;
    };
  };
  createdBy: {
    id: number;
    name: string;
  };
}

export interface DashboardSummary {
  date: string;
  todaySales: {
    count: number;
    subtotal: string;
    taxTotal: string;
    total: string;
  };
  alerts: AlertCounts;
  recentSales: Array<{
    id: number;
    invoiceNo: string;
    customerName: string | null;
    total: string;
    status: SaleStatus;
    createdAt: string;
  }>;
  recentMovements: Array<{
    id: number;
    type: StockMovementType;
    qtyDelta: number;
    createdAt: string;
    batch: {
      id: number;
      batchNo: string;
      medicine: { id: number; name: string; sku: string };
    };
  }>;
}

export interface SalesReportTotals {
  saleCount: number;
  subtotal: string;
  taxTotal: string;
  total: string;
  returnCount: number;
  returnedUnits: number;
  returnedValue: string;
}

export interface SalesReportDay extends SalesReportTotals {
  date: string;
}

export interface SalesReport {
  from: string;
  to: string;
  totals: SalesReportTotals;
  breakdown: SalesReportDay[];
}

export interface StockValuationRow {
  batchId: number;
  batchNo: string;
  expiryDate: string;
  quantityOnHand: number;
  purchasePrice: string;
  salePrice: string;
  costValue: string;
  retailValue: string;
  expired: boolean;
  medicine: {
    id: number;
    name: string;
    sku: string;
    unit: string;
  };
  supplier: {
    id: number;
    name: string;
  } | null;
}

export interface StockValuation {
  asOf: string;
  rows: StockValuationRow[];
  totals: {
    batches: number;
    units: number;
    costValue: string;
    retailValue: string;
  };
}

export type ExpiryStatus = "EXPIRED" | "NEAR_EXPIRY";

export interface ExpiryReportBatch {
  batchId: number;
  batchNo: string;
  expiryDate: string;
  quantityOnHand: number;
  daysUntilExpiry: number;
  status: ExpiryStatus;
  purchasePrice: string;
  costValue: string;
}

export interface ExpiryReportGroup {
  medicineId: number;
  name: string;
  sku: string;
  unit: string;
  expiredBatches: number;
  expiredUnits: number;
  nearExpiryBatches: number;
  nearExpiryUnits: number;
  costValueAtRisk: string;
  batches: ExpiryReportBatch[];
}

export interface ExpiryReport {
  asOf: string;
  windowDays: number;
  expired: {
    batches: number;
    units: number;
    costValue: string;
  };
  nearExpiry: {
    batches: number;
    units: number;
    costValue: string;
  };
  groups: ExpiryReportGroup[];
}

export interface ReconciliationMismatch {
  batchId: number;
  batchNo: string;
  medicineId: number;
  medicineName: string;
  opening: number;
  purchases: number;
  sales: number;
  returns: number;
  adjustments: number;
  closing: number;
  currentQuantity: number;
  difference: number;
}

export interface ReconciliationReport {
  from: string;
  to: string;
  checksCurrent: boolean;
  checkedBatches: number;
  mismatchCount: number;
  mismatches: ReconciliationMismatch[];
}

export interface AuditLogEntry {
  id: number;
  userId: number;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface PharmacySettings {
  defaultTaxRate: string;
  nearExpiryDays: number;
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
