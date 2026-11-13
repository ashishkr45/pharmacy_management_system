"use client";

import { useState } from "react";
import { Clock, IndianRupee, Package, TriangleAlert } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildQuery } from "@/lib/api/client";
import type { ExpiryReport, ExpiryReportGroup } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const columns: DataTableColumn<ExpiryReportGroup>[] = [
  {
    key: "medicine",
    header: "Medicine",
    cell: (group) => (
      <div className="max-w-52 space-y-0.5 whitespace-normal">
        <p className="font-medium">{group.name}</p>
        <p className="font-mono text-[0.625rem] text-muted-foreground">
          {group.sku} · {group.unit}
        </p>
      </div>
    ),
  },
  {
    key: "expired",
    header: "Expired",
    cell: (group) =>
      group.expiredBatches === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="space-y-0.5">
          <p className="font-medium text-destructive tabular-nums">
            {group.expiredBatches} batch
            {group.expiredBatches === 1 ? "" : "es"}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">
            {group.expiredUnits} unit{group.expiredUnits === 1 ? "" : "s"}
          </p>
        </div>
      ),
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
  {
    key: "nearExpiry",
    header: "Near expiry",
    cell: (group) =>
      group.nearExpiryBatches === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="space-y-0.5">
          <p className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">
            {group.nearExpiryBatches} batch
            {group.nearExpiryBatches === 1 ? "" : "es"}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">
            {group.nearExpiryUnits} unit{group.nearExpiryUnits === 1 ? "" : "s"}
          </p>
        </div>
      ),
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
  {
    key: "cost",
    header: "Cost at risk",
    cell: (group) => formatMoney(group.costValueAtRisk),
    headerClassName: "text-right",
    cellClassName: "text-right font-medium tabular-nums",
  },
  {
    key: "batches",
    header: "Batches in window",
    cell: (group) => (
      <div className="flex max-w-md flex-wrap gap-1.5 whitespace-normal">
        {group.batches.map((batch) => (
          <Badge
            key={batch.batchId}
            variant={batch.status === "EXPIRED" ? "destructive" : "outline"}
            className={cn(
              "h-auto flex-col items-start gap-0 rounded-md px-1.5 py-1 font-normal",
              batch.status === "NEAR_EXPIRY" &&
                "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
            )}
          >
            <span className="font-mono text-[0.625rem]">{batch.batchNo}</span>
            <span className="text-[0.625rem]">
              {batch.quantityOnHand} {group.unit} · exp{" "}
              {formatDate(batch.expiryDate)}
            </span>
          </Badge>
        ))}
      </div>
    ),
  },
];

export function ExpiryReportView() {
  const [daysInput, setDaysInput] = useState("");
  const debouncedDays = useDebouncedValue(daysInput.trim(), 300);
  const parsedDays = Number(debouncedDays);
  const daysParam =
    /^\d+$/.test(debouncedDays) &&
    parsedDays >= 1 &&
    parsedDays <= 3650
      ? parsedDays
      : undefined;
  const daysInvalid =
    daysInput.trim() !== "" &&
    (!/^\d+$/.test(daysInput.trim()) ||
      Number(daysInput) < 1 ||
      Number(daysInput) > 3650);

  const path = `/reports/expiry${buildQuery({ days: daysParam })}`;
  const report = useApiItem<ExpiryReport>(path);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <label className="w-full space-y-1 text-xs font-medium text-muted-foreground sm:w-auto">
          <span>Near-expiry window (days)</span>
          <Input
            type="number"
            min={1}
            max={3650}
            step={1}
            value={daysInput}
            onChange={(event) => setDaysInput(event.target.value)}
            placeholder="Use setting"
            className="w-full sm:w-40"
            aria-label="Near-expiry window in days"
            aria-invalid={daysInvalid}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {daysInput !== "" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDaysInput("")}
            >
              Use configured window
            </Button>
          ) : null}
          {report.data ? (
            <p className="text-xs text-muted-foreground">
              Window: {report.data.windowDays} days · as of{" "}
              {formatDate(report.data.asOf)}
            </p>
          ) : null}
        </div>
      </div>
      {daysInvalid ? (
        <p role="alert" className="text-xs text-destructive">
          Use a whole number between 1 and 3,650. The configured window is shown
          in the meantime.
        </p>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">
          Expired means the expiry date is today or earlier. Near expiry covers
          unexpired batches inside the selected window. Leave the field empty to
          use the admin-configured window.
        </p>
      )}

      {report.isLoading ? (
        <Card>
          <LoadingState label="Loading expiry report..." />
        </Card>
      ) : report.error ? (
        <Card>
          <ErrorState
            title="Expiry report unavailable"
            message={report.error}
            onRetry={report.reload}
          />
        </Card>
      ) : report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Expired batches"
              value={String(report.data.expired.batches)}
              hint={`${report.data.expired.units} unit${
                report.data.expired.units === 1 ? "" : "s"
              } still on hand`}
              icon={TriangleAlert}
              tone={report.data.expired.batches > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Expired cost"
              value={formatMoney(report.data.expired.costValue)}
              hint="Purchase cost of expired stock"
              icon={IndianRupee}
              tone={report.data.expired.batches > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Near-expiry batches"
              value={String(report.data.nearExpiry.batches)}
              hint={`${report.data.nearExpiry.units} unit${
                report.data.nearExpiry.units === 1 ? "" : "s"
              } inside the window`}
              icon={Clock}
              tone={report.data.nearExpiry.batches > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Near-expiry cost"
              value={formatMoney(report.data.nearExpiry.costValue)}
              hint="Still sellable before expiry"
              icon={Package}
              tone={report.data.nearExpiry.batches > 0 ? "warning" : "default"}
            />
          </div>

          <DataTable
            columns={columns}
            rows={report.data.groups}
            getRowKey={(group) => group.medicineId}
            caption="Expiry exposure grouped by medicine"
            emptyTitle="No expiry exposure"
            emptyDescription="No batches with stock on hand fall inside the selected window."
          />
        </>
      ) : null}
    </div>
  );
}
