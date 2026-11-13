"use client";

import { useState } from "react";
import {
  CalendarDays,
  Percent,
  ReceiptText,
  Undo2,
  Wallet,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatCard } from "@/components/shared/stat-card";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { Card } from "@/components/ui/card";
import { buildQuery } from "@/lib/api/client";
import type { SalesReport, SalesReportDay } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";
import {
  defaultReportRange,
  rangeValidationError,
  type ReportRange,
} from "@/lib/reports";

const columns: DataTableColumn<SalesReportDay>[] = [
  {
    key: "date",
    header: "Day",
    cell: (day) => formatDate(day.date),
    cellClassName: "font-medium",
  },
  {
    key: "sales",
    header: "Sales",
    cell: (day) => day.saleCount,
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "subtotal",
    header: "Subtotal",
    cell: (day) => formatMoney(day.subtotal),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "tax",
    header: "Tax",
    cell: (day) => formatMoney(day.taxTotal),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "total",
    header: "Collected",
    cell: (day) => formatMoney(day.total),
    headerClassName: "text-right",
    cellClassName: "text-right font-medium tabular-nums",
  },
  {
    key: "returns",
    header: "Returns",
    cell: (day) =>
      day.returnCount === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="space-y-0.5">
          <p className="tabular-nums">
            {day.returnCount} record{day.returnCount === 1 ? "" : "s"}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">
            {day.returnedUnits} unit{day.returnedUnits === 1 ? "" : "s"}
          </p>
        </div>
      ),
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
  {
    key: "returnedValue",
    header: "Return value",
    cell: (day) =>
      day.returnCount === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        formatMoney(day.returnedValue)
      ),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums text-muted-foreground",
  },
];

export function SalesReportView() {
  const [range, setRange] = useState<ReportRange>(() => defaultReportRange());
  const rangeError = rangeValidationError(range.from, range.to);
  const path = rangeError
    ? null
    : `/reports/sales${buildQuery({
        from: range.from,
        to: range.to,
      })}`;
  const report = useApiItem<SalesReport>(path);

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
            description="The sales report needs both dates, and From cannot be after To."
            icon={CalendarDays}
          />
        </Card>
      ) : report.isLoading ? (
        <Card>
          <LoadingState label="Loading sales report..." />
        </Card>
      ) : report.error ? (
        <Card>
          <ErrorState
            title="Sales report unavailable"
            message={report.error}
            onRetry={report.reload}
          />
        </Card>
      ) : report.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Collected"
              value={formatMoney(report.data.totals.total)}
              hint={`${report.data.totals.saleCount} sale${report.data.totals.saleCount === 1 ? "" : "s"} in range`}
              icon={Wallet}
            />
            <StatCard
              label="Subtotal"
              value={formatMoney(report.data.totals.subtotal)}
              hint="Before tax"
              icon={ReceiptText}
            />
            <StatCard
              label="Tax"
              value={formatMoney(report.data.totals.taxTotal)}
              hint="Sum of recorded line tax"
              icon={Percent}
            />
            <StatCard
              label="Returned value"
              value={formatMoney(report.data.totals.returnedValue)}
              hint={`${report.data.totals.returnedUnits} unit${
                report.data.totals.returnedUnits === 1 ? "" : "s"
              } across ${report.data.totals.returnCount} record${
                report.data.totals.returnCount === 1 ? "" : "s"
              }`}
              icon={Undo2}
              tone={report.data.totals.returnCount > 0 ? "warning" : "default"}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs/relaxed text-muted-foreground">
              Collected is gross, tax-inclusive sales recorded at the counter.
              Returns are shown separately at their proportional tax-inclusive
              value; neither column is netted against the other. Days follow the
              server&apos;s UTC calendar.
            </p>
          </div>

          <DataTable
            columns={columns}
            rows={report.data.breakdown}
            getRowKey={(day) => day.date}
            caption="Sales and returns by day"
            emptyTitle="No activity in this range"
            emptyDescription="No sales or returns were recorded for the selected dates."
            emptyAction={
              <p className="text-xs text-muted-foreground">
                Try widening the date range.
              </p>
            }
          />
        </>
      ) : null}
    </div>
  );
}
