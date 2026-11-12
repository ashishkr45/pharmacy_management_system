"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovementTypeBadge } from "@/components/inventory/movement-type-badge";
import { buildQuery } from "@/lib/api/client";
import { STOCK_MOVEMENT_TYPES, type StockMovement } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { cn } from "@/lib/utils";

export interface MovementBatchFilter {
  id: number;
  batchNo: string;
}

const TYPE_ITEMS = [
  { label: "All types", value: "all" },
  ...STOCK_MOVEMENT_TYPES.map((type) => ({
    label: type.charAt(0) + type.slice(1).toLowerCase(),
    value: type,
  })),
];

export function MovementsPanel({
  batchFilter,
  onClearBatch,
}: {
  batchFilter: MovementBatchFilter | null;
  onClearBatch: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const hasFilters = typeFilter !== "all" || from !== "" || to !== "";
  const path = `/stock-movements${buildQuery({
    page,
    pageSize: 20,
    batchId: batchFilter?.id,
    type: typeFilter === "all" ? undefined : typeFilter,
    from: from || undefined,
    to: to || undefined,
  })}`;
  const list = useApiList<StockMovement>(path);

  const clearFilters = () => {
    setTypeFilter("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: "when",
      header: "When",
      cell: (movement) => (
        <span className="whitespace-nowrap">
          {formatDateTime(movement.createdAt)}
        </span>
      ),
      cellClassName: "text-muted-foreground",
    },
    {
      key: "type",
      header: "Type",
      cell: (movement) => <MovementTypeBadge type={movement.type} />,
    },
    {
      key: "medicine",
      header: "Medicine / batch",
      cell: (movement) => (
        <div className="space-y-0.5">
          <p className="font-medium">{movement.batch.medicine.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {movement.batch.batchNo}
          </p>
        </div>
      ),
    },
    {
      key: "delta",
      header: "Change",
      cell: (movement) => (
        <span
          className={cn(
            "font-heading font-medium tabular-nums",
            movement.qtyDelta > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {movement.qtyDelta > 0 ? "+" : ""}
          {movement.qtyDelta}
        </span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "reason",
      header: "Reason / reference",
      cell: (movement) => (
        <div className="max-w-52 space-y-0.5">
          <p>{movement.reason ?? "—"}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {movement.referenceType}
            {movement.referenceId ? ` #${movement.referenceId}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "by",
      header: "By",
      cell: (movement) => movement.createdBy?.name ?? "System",
      cellClassName: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-3">
      {batchFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            Batch {batchFilter.batchNo}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClearBatch}
          >
            <X aria-hidden="true" />
            Show all movements
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-40">
            <Select
              items={TYPE_ITEMS}
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value ?? "all");
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter movements by type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="w-36"
              aria-label="Movements from date"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="w-36"
              aria-label="Movements to date"
            />
          </label>

          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} movement
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Append-only ledger, newest first. Every quantity change appears here,
        including purchases, sales, returns, adjustments and opening stock.
      </p>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(movement) => movement.id}
        caption="Stock movement ledger"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No stock movements found"
        emptyDescription={
          hasFilters || batchFilter
            ? "Try clearing the batch, type or date filters."
            : "Stock changes will appear here after a purchase, sale, return or adjustment."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
