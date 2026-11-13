import type { AdjustmentReason } from "@/lib/api/types";

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  DAMAGED: "Damaged",
  EXPIRED: "Expired write-off",
  COUNT_CORRECTION: "Count correction",
  LOST: "Lost",
  OTHER: "Other",
};

export const ADJUSTMENT_REASON_HINTS: Record<AdjustmentReason, string> = {
  DAMAGED: "Units damaged and removed from sellable stock.",
  EXPIRED: "Expired units written off. Expiry is date-based.",
  COUNT_CORRECTION: "A physical count differs from the recorded quantity.",
  LOST: "Units that cannot be found during a count.",
  OTHER: "A note is required to explain this adjustment.",
};
