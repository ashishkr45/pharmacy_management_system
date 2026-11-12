"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { BatchesPanel } from "@/components/inventory/batches-panel";
import { ExpiryPanel } from "@/components/inventory/expiry-panel";
import { LowStockPanel } from "@/components/inventory/low-stock-panel";
import {
  MovementsPanel,
  type MovementBatchFilter,
} from "@/components/inventory/movements-panel";

type InventoryView =
  | "all"
  | "active"
  | "near"
  | "expired"
  | "low"
  | "movements";

const VIEWS: Array<{ value: InventoryView; label: string }> = [
  { value: "all", label: "All batches" },
  { value: "active", label: "Active stock" },
  { value: "near", label: "Near expiry" },
  { value: "expired", label: "Expired" },
  { value: "low", label: "Low stock" },
  { value: "movements", label: "Movements" },
];

const VIEW_DESCRIPTIONS: Record<InventoryView, string> = {
  all: "Every batch with its quantity, expiry, cost and sale price.",
  active: "Sellable batches only: unexpired and with stock on hand.",
  near: "Unexpired stock inside the near-expiry window from settings.",
  expired: "Expired stock still on hand; these batches are blocked from sales.",
  low: "Active medicines whose unexpired stock is below the reorder level.",
  movements: "The append-only ledger behind every batch quantity.",
};

export function InventoryView() {
  const [view, setView] = useState<InventoryView>("all");
  const [movementBatch, setMovementBatch] =
    useState<MovementBatchFilter | null>(null);

  const selectView = (next: InventoryView) => {
    if (next === "movements") {
      setMovementBatch(null);
    }
    setView(next);
  };

  const openMovements = (batchId: number, batchNo: string) => {
    setMovementBatch({ id: batchId, batchNo });
    setView("movements");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Batch-level stock, expiry exposure and the stock movement ledger. All roles can inspect inventory; receiving and adjustments are role-restricted."
      />

      <div className="space-y-3">
        <div
          role="group"
          aria-label="Inventory view"
          className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
        >
          {VIEWS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={view === item.value ? "secondary" : "ghost"}
              aria-pressed={view === item.value}
              onClick={() => selectView(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {VIEW_DESCRIPTIONS[view]}
        </p>
      </div>

      {view === "all" || view === "active" ? (
        <BatchesPanel mode={view} onViewMovements={openMovements} />
      ) : null}

      {view === "near" || view === "expired" ? (
        <ExpiryPanel mode={view} onViewMovements={openMovements} />
      ) : null}

      {view === "low" ? <LowStockPanel /> : null}

      {view === "movements" ? (
        <MovementsPanel
          key={`movements-${movementBatch?.id ?? "all"}`}
          batchFilter={movementBatch}
          onClearBatch={() => setMovementBatch(null)}
        />
      ) : null}
    </div>
  );
}
