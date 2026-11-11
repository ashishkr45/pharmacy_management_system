"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Package,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface DashboardSummary {
  date: string;
  todaySales: {
    count: number;
    subtotal: string;
    taxTotal: string;
    total: string;
  };
  alerts: {
    lowStock: number;
    nearExpiry: number;
    expired: number;
  };
  recentSales: Array<{
    id: number;
    invoiceNo: string;
    customerName: string | null;
    total: string;
    status: string;
    createdAt: string;
  }>;
  recentMovements: Array<{
    id: number;
    type: string;
    qtyDelta: number;
    createdAt: string;
    batch: {
      id: number;
      batchNo: string;
      medicine: { id: number; name: string; sku: string };
    };
  }>;
}

const saleColumns: DataTableColumn<DashboardSummary["recentSales"][number]>[] = [
  {
    key: "invoice",
    header: "Invoice",
    cell: (sale) => (
      <span className="font-medium">{sale.invoiceNo}</span>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    cell: (sale) => sale.customerName ?? "Walk-in",
  },
  {
    key: "status",
    header: "Status",
    cell: (sale) => (
      <Badge variant="outline" className="capitalize">
        {sale.status.replaceAll("_", " ").toLowerCase()}
      </Badge>
    ),
  },
  {
    key: "time",
    header: "Time",
    cell: (sale) => formatTime(sale.createdAt),
    cellClassName: "text-muted-foreground",
  },
  {
    key: "total",
    header: "Total",
    cell: (sale) => formatMoney(sale.total),
    headerClassName: "text-right",
    cellClassName: "text-right font-medium tabular-nums",
  },
];

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatSummaryDate(value: string | undefined): string {
  if (!value) {
    return "Today";
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? "Today"
    : date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      });
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : tone === "warning"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;

    apiRequest<DashboardSummary>("/dashboard/summary")
      .then((data) => {
        if (active) {
          setSummary(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "The dashboard could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const firstName = user?.name.split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description={`${formatSummaryDate(summary?.date)} · The current state of the pharmacy.`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retry}
              disabled={loading}
            >
              <RefreshCw
                className={cn("size-3.5", loading && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Link
              href="/alerts"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              View alerts
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={retry} />
        </Card>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Revenue today"
              value={formatMoney(summary.todaySales.total)}
              hint={`${summary.todaySales.count} sale${summary.todaySales.count === 1 ? "" : "s"} today`}
              icon={Wallet}
            />
            <StatCard
              label="Low stock"
              value={String(summary.alerts.lowStock)}
              hint="Medicines below their reorder level"
              icon={Package}
              tone={summary.alerts.lowStock > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Near expiry"
              value={String(summary.alerts.nearExpiry)}
              hint="Batches inside the alert window"
              icon={Clock}
              tone={summary.alerts.nearExpiry > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Expired"
              value={String(summary.alerts.expired)}
              hint="Batches blocked from sale"
              icon={TriangleAlert}
              tone={summary.alerts.expired > 0 ? "danger" : "default"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-medium">
                    Recent sales
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Latest invoices written today
                  </p>
                </div>
                <Link
                  href="/sales"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <DataTable
                columns={saleColumns}
                rows={summary.recentSales}
                getRowKey={(sale) => sale.id}
                caption="Recent sales"
                emptyTitle="No sales yet today"
                emptyDescription="Sales created at the counter will appear here."
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-sm font-medium">
                    Stock movements
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Latest entries in the immutable ledger
                  </p>
                </div>
                <Link
                  href="/inventory"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open inventory
                </Link>
              </div>
              <Card size="sm">
                <CardHeader className="sr-only">
                  <CardTitle>Recent stock movements</CardTitle>
                  <CardDescription>
                    The newest entries in the stock ledger
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary.recentMovements.length === 0 ? (
                    <EmptyState
                      title="No movements yet"
                      description="Opening stock and every later change will be listed here."
                    />
                  ) : (
                    <div className="divide-y">
                      {summary.recentMovements.map((movement) => (
                        <div
                          key={movement.id}
                          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {movement.batch.medicine.name}
                            </p>
                            <p className="truncate text-[0.6875rem] text-muted-foreground">
                              {movement.type.replaceAll("_", " ")} ·{" "}
                              {movement.batch.batchNo}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-xs font-medium tabular-nums",
                              movement.qtyDelta >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive",
                            )}
                          >
                            {movement.qtyDelta > 0 ? "+" : ""}
                            {movement.qtyDelta}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
