import type { PaymentMethod, SaleStatus } from "@/lib/api/types";

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: "Completed",
  PARTIALLY_RETURNED: "Partially returned",
  FULLY_RETURNED: "Fully returned",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
};
