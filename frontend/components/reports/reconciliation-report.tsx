"use client";

import { useState } from "react";
import {
  Boxes,
  CalendarDays,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { Card, CardContent } from "@/components/ui/card";
import { buildQuery } from "@/lib/api/client";
import type {
  ReconciliationMismatch,
  ReconciliationReport,
} from "@/lib/api/types";
import { useApiItem } from "@/lib/hooks/use-api-item";
import {
  defaultReportRange,
  rangeValidationError,
  type ReportRange,
} from "@/lib/reports";
import { formatDate } from "@/lib/format";

const columns: DataTableColumn<ReconciliationMismatch>[] = [
  {
    key: "batch",
    header: "Batch",
    cell: (row) => (
      <div className="max-w-48 space-y-0.5 whitespace-normal">
        <p className="font-mono text-[0.6875rem]">{row.batchNo}</p>
        <p className="text-[0.6875rem] text-muted-foreground">
          {row.medicineName}
        </p>
      </div>
    ),
  },
  {
    key: "opening",
    header: "Opening",
    cell: (row) => row.opening,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "purchases",
    header: "Purchases",
    cell: (row) => row.purchases,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "sales",
    header: "Sales",
    cell: (row) => row.sales,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "returns",
    header: "Returns",
    cell: (row) => row.returns,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "adjustments",
    header: "Adjustments",
    cell: (row) => row.adjustments,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "closing",
    header: "Closing",
    cell: (row) => row.closing,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "current",
    header: "Current",
    cell: (row) => row.currentQuantity,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "difference",
    header: "Difference",
    cell: (row) => (
      <span className="font-medium text-destructive tabular-nums">
        {row.difference > 0 ? "+" : ""}
        {row.difference}
      </span>
    ),
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
];

export function ReconciliationReportView() {
  const [range, setRange] = useState<ReportRange>(() => defaultReportRange());
  const rangeError = rangeValidationError(range.from, range.to);
  const path = rangeError
    ? null
    : `/reports/reconciliation${buildQuery({
        from: range.from,
        to: range.to,
      })}`;
  const report = useApiItem<ReconciliationReport>(path);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          onFromChange={(from) => setRange((previous) => ({ ...previous, from }))}
          onToChange={(to) => setRange((previous) => ({ ...previous, to }))}
          onReset={() => setRange(defaultReportRange())}
        />
        {report.data ? (
          <p className="text-xs text-muted-foreground">
            {formatDate(report.data.from)} to {formatDate(report.data.to)}
          </p>
        ) : null}
      </div>

      {rangeError ? (
        <Card>
          <EmptyState
            title="Choose a valid date range"
            description="The reconciliation report needs both dates, and From cannot be after To."
            icon={CalendarDays}
          />
        </Card>
      ) : report.isLoading ? (
        <Card>
          <LoadingState label="Rebuilding batch balances from the ledger..." />
        </Card>
      ) : report.error ? (
        <Card>
          <ErrorState
            title="Reconciliation unavailable"
            message={report.error}
            onRetry={report.reload}
          />
        </Card>
      ) : report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Checked batches"
              value={String(report.data.checkedBatches)}
              hint="Batches created up to the end date"
              icon={Boxes}
            />
            <StatCard
              label="Mismatches"
              value={
                report.data.checksCurrent
                  ? String(report.data.mismatchCount)
                  : "—"
              }
              hint={
                report.data.checksCurrent
                  ? report.data.mismatchCount === 0
                    ? "No differences found"
                    : "Ledger and batch quantity disagree"
                  : "Not evaluated for a past range"
              }
              icon={TriangleAlert}
              tone={
                !report.data.checksCurrent
                  ? "warning"
                  : report.data.mismatchCount > 0
                    ? "danger"
                    : "success"
              }
            />
            <StatCard
              label="Result"
              value={
                !report.data.checksCurrent
                  ? "Historical"
                  : report.data.mismatchCount === 0
                    ? "Reconciled"
                    : "Review"
              }
              hint={
                !report.data.checksCurrent
                  ? "End date must be today or later"
                  : report.data.mismatchCount === 0
                    ? "SUM(ledger delta) equals quantity on hand"
                    : "Inspect the mismatch rows below"
              }
              icon={ShieldCheck}
              tone={
                !report.data.checksCurrent
                  ? "warning"
                  : report.data.mismatchCount === 0
                    ? "success"
                    : "danger"
              }
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs/relaxed text-muted-foreground">
              The server rebuilds each batch as opening + purchases − sales +
              returns + adjustments. Opening includes ledger rows before the
              range plus an OPENING row created inside it. Dates are server
              calendar days (UTC), and a live comparison is only possible when
              the range ends today or later.
            </p>
          </div>

          {!report.data.checksCurrent ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-start gap-3">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="font-medium">Historical range, not verified</p>
                  <p className="text-xs/relaxed text-muted-foreground">
                    This range ends before today, so later movements could have
                    changed the current batch quantities. Move the end date to
                    today or later for a live reconciliation check.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : report.data.mismatchCount === 0 ? (
            <Card className="border-emerald-600/30 bg-emerald-500/5">
              <CardContent className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <p className="font-medium">The ledger reconciles</p>
                  <p className="text-xs/relaxed text-muted-foreground">
                    All {report.data.checkedBatches} checked batch
                    {report.data.checkedBatches === 1 ? "" : "es"} have a closing
                    balance equal to their current quantity on hand. No
                    differences were found in this range.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DataTable
              columns={columns}
              rows={report.data.mismatches}
              getRowKey={(row) => row.batchId}
              caption="Batch reconciliation mismatches"
              emptyTitle="No mismatches"
              emptyDescription="Every checked batch matched its current quantity."
            />
          )}
        </>
      ) : null}
    </div>
  );
}
