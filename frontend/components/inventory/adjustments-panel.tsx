"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildQuery } from "@/lib/api/client";
import {
  ADJUSTMENT_REASONS,
  type Adjustment,
} from "@/lib/api/types";
import { ADJUSTMENT_REASON_LABELS } from "@/lib/adjustments";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { cn } from "@/lib/utils";

const REASON_FILTER_ITEMS = [
  { label: "All reasons", value: "all" },
  ...ADJUSTMENT_REASONS.map((reason) => ({
    label: ADJUSTMENT_REASON_LABELS[reason],
    value: reason,
  })),
];

export function AdjustmentsPanel() {
  const [reasonFilter, setReasonFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const hasFilters = reasonFilter !== "all" || from !== "" || to !== "";
  const path = `/adjustments${buildQuery({
    page,
    pageSize: 20,
    reasonCode: reasonFilter === "all" ? undefined : reasonFilter,
    from: from || undefined,
    to: to || undefined,
  })}`;
  const list = useApiList<Adjustment>(path);

  const columns: DataTableColumn<Adjustment>[] = [
    {
      key: "created",
      header: "Recorded",
      cell: (adjustment) => (
        <div className="space-y-0.5">
          <p className="whitespace-nowrap">
            {formatDateTime(adjustment.createdAt)}
          </p>
          <p className="text-[0.625rem] text-muted-foreground">
            by {adjustment.createdBy.name}
          </p>
        </div>
      ),
      cellClassName: "text-muted-foreground",
    },
    {
      key: "medicine",
      header: "Medicine",
      cell: (adjustment) => (
        <div className="space-y-0.5">
          <p className="font-medium">{adjustment.batch.medicine.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {adjustment.batch.medicine.sku}
          </p>
        </div>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      cell: (adjustment) => (
        <div className="space-y-0.5">
          <p className="font-mono text-xs">{adjustment.batch.batchNo}</p>
          <p className="text-[0.625rem] text-muted-foreground">
            expires {formatDate(adjustment.batch.expiryDate)}
          </p>
        </div>
      ),
    },
    {
      key: "delta",
      header: "Change",
      cell: (adjustment) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            adjustment.delta > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {adjustment.delta > 0 ? "+" : ""}
          {adjustment.delta}
        </span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "onHand",
      header: "Current on hand",
      cell: (adjustment) => adjustment.batch.quantityOnHand,
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums text-muted-foreground",
    },
    {
      key: "reason",
      header: "Reason",
      cell: (adjustment) => (
        <div className="space-y-0.5">
          <p>{ADJUSTMENT_REASON_LABELS[adjustment.reasonCode]}</p>
          {adjustment.note ? (
            <p
              className="max-w-64 truncate text-[0.625rem] text-muted-foreground"
              title={adjustment.note}
            >
              {adjustment.note}
            </p>
          ) : null}
        </div>
      ),
    },
  ];

  const clearFilters = () => {
    setReasonFilter("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-44">
            <Select
              items={REASON_FILTER_ITEMS}
              value={reasonFilter}
              onValueChange={(value) => {
                setReasonFilter(value ?? "all");
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter adjustments by reason"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_FILTER_ITEMS.map((item) => (
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
              aria-label="Adjustments from date"
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
              aria-label="Adjustments to date"
            />
          </label>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              <X aria-hidden="true" />
              Clear filters
            </Button>
          ) : null}
        </div>

        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} adjustment
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Every adjustment has a signed quantity, a reason and a matching
        ADJUSTMENT row in the stock-movement ledger. The current on-hand column
        is the batch quantity now, not the quantity at the time of the
        adjustment.
      </p>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(adjustment) => adjustment.id}
        caption="Stock adjustment history"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No stock adjustments found"
        emptyDescription={
          hasFilters
            ? "Try clearing the reason or date filters."
            : "Damaged, expired, lost or counted stock will appear here with its reason and note."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
