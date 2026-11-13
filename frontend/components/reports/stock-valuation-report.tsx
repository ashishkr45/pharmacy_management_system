"use client";

import { useState } from "react";
import { Boxes, IndianRupee, Package, Tag } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildQuery } from "@/lib/api/client";
import type { StockValuation, StockValuationRow } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";

const columns: DataTableColumn<StockValuationRow>[] = [
  {
    key: "medicine",
    header: "Medicine",
    cell: (row) => (
      <div className="max-w-52 space-y-0.5 whitespace-normal">
        <p className="font-medium">{row.medicine.name}</p>
        <p className="font-mono text-[0.625rem] text-muted-foreground">
          {row.medicine.sku} · {row.medicine.unit}
        </p>
      </div>
    ),
  },
  {
    key: "batch",
    header: "Batch",
    cell: (row) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-[0.6875rem]">{row.batchNo}</p>
          {row.expired ? <Badge variant="destructive">Expired</Badge> : null}
        </div>
        <p className="text-[0.6875rem] text-muted-foreground">
          expires {formatDate(row.expiryDate)}
        </p>
      </div>
    ),
  },
  {
    key: "quantity",
    header: "On hand",
    cell: (row) => row.quantityOnHand,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "purchasePrice",
    header: "Cost / unit",
    cell: (row) => formatMoney(row.purchasePrice),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "salePrice",
    header: "Retail / unit",
    cell: (row) => formatMoney(row.salePrice),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "costValue",
    header: "Cost value",
    cell: (row) => formatMoney(row.costValue),
    headerClassName: "text-right",
    cellClassName: "text-right font-medium tabular-nums",
  },
  {
    key: "retailValue",
    header: "Retail value",
    cell: (row) => formatMoney(row.retailValue),
    headerClassName: "text-right",
    cellClassName: "text-right font-medium tabular-nums",
  },
  {
    key: "supplier",
    header: "Supplier",
    cell: (row) => row.supplier?.name ?? "—",
    cellClassName: "text-muted-foreground",
  },
];

export function StockValuationReportView() {
  const [includeZero, setIncludeZero] = useState(false);
  const path = `/reports/stock-valuation${buildQuery({
    includeZero: includeZero ? true : undefined,
  })}`;
  const report = useApiItem<StockValuation>(path);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(event) => setIncludeZero(event.target.checked)}
            className="size-3.5 accent-primary"
          />
          Include batches with zero stock
        </label>
        {report.data ? (
          <p className="text-xs text-muted-foreground">
            As of {formatDate(report.data.asOf)} · {report.data.totals.batches}{" "}
            batch{report.data.totals.batches === 1 ? "" : "es"}
          </p>
        ) : null}
      </div>

      {report.isLoading ? (
        <Card>
          <LoadingState label="Loading stock valuation..." />
        </Card>
      ) : report.error ? (
        <Card>
          <ErrorState
            title="Stock valuation unavailable"
            message={report.error}
            onRetry={report.reload}
          />
        </Card>
      ) : report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Batches"
              value={String(report.data.totals.batches)}
              hint={includeZero ? "Including zero stock" : "With stock on hand"}
              icon={Boxes}
            />
            <StatCard
              label="Units on hand"
              value={String(report.data.totals.units)}
              hint="Sum of batch quantities"
              icon={Package}
            />
            <StatCard
              label="Cost value"
              value={formatMoney(report.data.totals.costValue)}
              hint="Purchase price × quantity"
              icon={IndianRupee}
            />
            <StatCard
              label="Retail value"
              value={formatMoney(report.data.totals.retailValue)}
              hint="Sale price × quantity"
              icon={Tag}
            />
          </div>

          <p className="text-xs/relaxed text-muted-foreground">
            Valuation uses current batch quantities and the server&apos;s stored
            prices. Expired stock is included and flagged in red; it cannot be
            sold through the POS.
          </p>

          <DataTable
            columns={columns}
            rows={report.data.rows}
            getRowKey={(row) => row.batchId}
            caption="Stock valuation by batch"
            emptyTitle="No stock to value"
            emptyDescription={
              includeZero
                ? "No batch records match the current valuation."
                : "All batches currently have zero stock on hand."
            }
            emptyAction={
              includeZero ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeZero(true)}
                >
                  Include zero-stock batches
                </Button>
              )
            }
          />
        </>
      ) : null}
    </div>
  );
}
