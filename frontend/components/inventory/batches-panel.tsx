"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { buildQuery } from "@/lib/api/client";
import type { Batch } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

export function BatchesPanel({
  mode,
  onViewMovements,
}: {
  mode: "all" | "active";
  onViewMovements: (batchId: number, batchNo: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const path = `/batches${buildQuery({
    page,
    pageSize: 20,
    search,
    expired: mode === "active" ? false : undefined,
    hasStock: mode === "active" ? true : undefined,
  })}`;
  const list = useApiList<Batch>(path);

  const columns: DataTableColumn<Batch>[] = [
    {
      key: "medicine",
      header: "Medicine",
      cell: (batch) => (
        <div className="space-y-0.5">
          <p className="font-medium">{batch.medicine.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {batch.medicine.sku} · {batch.medicine.unit}
          </p>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      cell: (batch) => (
        <span className="font-mono text-xs">{batch.batchNo}</span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      cell: (batch) => batch.supplier?.name ?? "-",
      cellClassName: "text-muted-foreground",
    },
    {
      key: "expiry",
      header: "Expiry",
      cell: (batch) => (
        <div className="flex flex-col items-start gap-1">
          <span>{formatDate(batch.expiryDate)}</span>
          <ExpiryBadge
            expiryDate={batch.expiryDate}
            daysUntilExpiry={batch.daysUntilExpiry}
            expired={batch.expired}
          />
        </div>
      ),
    },
    {
      key: "quantity",
      header: "On hand",
      cell: (batch) => (
        <span
          className={
            batch.quantityOnHand === 0 ? "text-muted-foreground" : "font-medium"
          }
        >
          {batch.quantityOnHand}
        </span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "purchasePrice",
      header: "Cost",
      cell: (batch) => formatMoney(batch.purchasePrice),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "salePrice",
      header: "Sale",
      cell: (batch) => formatMoney(batch.salePrice),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "actions",
      header: <span className="sr-only">Ledger</span>,
      cell: (batch) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onViewMovements(batch.id, batch.batchNo)}
          aria-label={`View stock movements for batch ${batch.batchNo}`}
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
          label="Search inventory batches"
        />
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} batch
            {list.data.meta.total === 1 ? "" : "es"}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "active"
          ? "Only unexpired batches with stock on hand are shown."
          : "Every batch, including expired and zero-stock batches, ordered by soonest expiry."}
      </p>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(batch) => batch.id}
        caption="Inventory batches"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle={
          mode === "active" ? "No active stock" : "No batches found"
        }
        emptyDescription={
          search
            ? "Try a different medicine name or batch number."
            : mode === "active"
              ? "Receive a purchase with an unexpired batch to add sellable stock."
              : "Receive a purchase to create the first batch."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
