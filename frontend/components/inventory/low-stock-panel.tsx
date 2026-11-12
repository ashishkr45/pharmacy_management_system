"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { buildQuery } from "@/lib/api/client";
import type { LowStockItem } from "@/lib/api/types";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

export function LowStockPanel() {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);

  const path = `/alerts/low-stock${buildQuery({
    page,
    pageSize: 20,
    search,
  })}`;
  const list = useApiList<LowStockItem>(path);

  const columns: DataTableColumn<LowStockItem>[] = [
    {
      key: "medicine",
      header: "Medicine",
      cell: (item) => (
        <div className="space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {item.sku}
          </p>
        </div>
      ),
    },
    {
      key: "available",
      header: "Sellable stock",
      cell: (item) => (
        <span className="font-medium">
          {item.availableQuantity} {item.unit}
        </span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "reorder",
      header: "Reorder level",
      cell: (item) => `${item.reorderLevel} ${item.unit}`,
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums text-muted-foreground",
    },
    {
      key: "shortfall",
      header: "Shortfall",
      cell: (item) => (
        <Badge
          variant="outline"
          className="border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20"
        >
          {item.shortfall} short
        </Badge>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "expired",
      header: "Expired stock",
      cell: (item) => `${item.expiredQuantity} ${item.unit}`,
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums text-muted-foreground",
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
          placeholder="Search medicine or SKU..."
          label="Search low-stock medicines"
        />
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} medicine
            {list.data.meta.total === 1 ? "" : "s"} below reorder level
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Low stock is calculated per medicine from unexpired, in-stock batches
        only. Expired stock is listed separately and cannot hide a shortage.
      </p>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(item) => item.medicineId}
        caption="Medicines below their reorder level"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No low-stock medicines"
        emptyDescription={
          search
            ? "No medicine matches this search."
            : "Every active medicine has enough unexpired stock."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
