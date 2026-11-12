"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { buildQuery } from "@/lib/api/client";
import type { ExpiryAlertItem } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

export function ExpiryPanel({
  mode,
  onViewMovements,
}: {
  mode: "near" | "expired";
  onViewMovements: (batchId: number, batchNo: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const endpoint = mode === "near" ? "near-expiry" : "expired";
  const path = `/alerts/${endpoint}${buildQuery({
    page,
    pageSize: 20,
    search,
  })}`;
  const list = useApiList<ExpiryAlertItem>(path);

  const columns: DataTableColumn<ExpiryAlertItem>[] = [
    {
      key: "medicine",
      header: "Medicine",
      cell: (item) => (
        <div className="space-y-0.5">
          <p className="font-medium">{item.medicine.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {item.medicine.sku} · {item.medicine.unit}
          </p>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      cell: (item) => <span className="font-mono text-xs">{item.batchNo}</span>,
    },
    {
      key: "expiry",
      header: "Expiry",
      cell: (item) => (
        <div className="flex flex-col items-start gap-1">
          <span>{formatDate(item.expiryDate)}</span>
          <ExpiryBadge
            expiryDate={item.expiryDate}
            daysUntilExpiry={item.daysUntilExpiry}
            expired={item.expired}
          />
        </div>
      ),
    },
    {
      key: "quantity",
      header: "On hand",
      cell: (item) => (
        <span className="font-medium">{item.quantityOnHand}</span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "actions",
      header: <span className="sr-only">Ledger</span>,
      cell: (item) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onViewMovements(item.batchId, item.batchNo)}
          aria-label={`View stock movements for batch ${item.batchNo}`}
        >
          <History aria-hidden="true" />
          Ledger
        </Button>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchInput}
          onChange={(value) => {
            setSearchInput(value);
            setPage(1);
          }}
          placeholder="Search medicine or batch..."
          label={
            mode === "near"
              ? "Search near-expiry batches"
              : "Search expired batches"
          }
        />
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} batch
            {list.data.meta.total === 1 ? "" : "es"}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "near"
          ? "Unexpired stock inside the near-expiry window configured in settings."
          : "Expired stock still on hand. Expired batches are blocked from sales but still count in valuation until written off."}
      </p>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(item) => item.batchId}
        caption={
          mode === "near" ? "Near-expiry batches" : "Expired batches on hand"
        }
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle={
          mode === "near" ? "No near-expiry stock" : "No expired stock on hand"
        }
        emptyDescription={
          search
            ? "Try a different medicine name or batch number."
            : mode === "near"
              ? "No batch is currently inside the near-expiry window."
              : "Every expired batch has already been written off or none exist."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
