"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { buildQuery } from "@/lib/api/client";
import type { SaleReturnRecord } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";

export function SaleReturns({ saleId }: { saleId: number }) {
  const [page, setPage] = useState(1);
  const path = `/returns${buildQuery({
    saleId,
    page,
    pageSize: 10,
  })}`;
  const list = useApiList<SaleReturnRecord>(path);

  const columns: DataTableColumn<SaleReturnRecord>[] = [
    {
      key: "created",
      header: "Returned",
      cell: (record) => (
        <div className="space-y-0.5">
          <p className="whitespace-nowrap">{formatDateTime(record.createdAt)}</p>
          <p className="text-[0.625rem] text-muted-foreground">
            by {record.createdBy.name}
          </p>
        </div>
      ),
      cellClassName: "text-muted-foreground",
    },
    {
      key: "medicine",
      header: "Medicine",
      cell: (record) => (
        <div className="space-y-0.5">
          <p className="font-medium">{record.saleItem.medicine.name}</p>
          <p className="font-mono text-[0.625rem] text-muted-foreground">
            {record.saleItem.medicine.sku} · batch{" "}
            {record.saleItem.batch.batchNo}
          </p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      cell: (record) => (
        <Badge variant="outline">
          {record.quantity} {record.saleItem.medicine.unit}
          {record.quantity === 1 ? "" : "s"}
        </Badge>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "reason",
      header: "Reason",
      cell: (record) => (
        <p className="max-w-md text-xs/relaxed">{record.reason}</p>
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-sm font-medium">Return history</h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Every return records the quantity, reason and staff member. The
            server never allows a line to be returned beyond its sold quantity.
          </p>
        </div>
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} return
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(record) => record.id}
        caption={`Return history for sale ${saleId}`}
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No returns recorded"
        emptyDescription="A return will appear here with its reason and the staff member who recorded it."
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </section>
  );
}
