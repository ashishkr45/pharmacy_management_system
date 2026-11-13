"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Package,
  Plus,
  RefreshCw,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";
import {
  canAccess,
  PURCHASE_WRITE_ROLES,
  SALE_WRITE_ROLES,
} from "@/lib/roles";
import { cn } from "@/lib/utils";

type DashboardSale = DashboardSummary["recentSales"][number];
type DashboardMovement = DashboardSummary["recentMovements"][number];

const saleColumns: DataTableColumn<DashboardSale>[] = [
  {
    key: "invoice",
    header: "Invoice",
    cell: (sale) => <span className="font-medium">{sale.invoiceNo}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    cell: (sale) => sale.customerName ?? "Walk-in",
  },
  {
    key: "status",
    header: "Status",
    cell: (sale) => <SaleStatusBadge status={sale.status} />,
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

function RecentSalesSection({ sales }: { sales: DashboardSale[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-medium">Recent sales</h2>
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
        rows={sales}
        getRowKey={(sale) => sale.id}
        caption="Recent sales"
        emptyTitle="No sales yet today"
        emptyDescription="Sales created at the counter will appear here."
      />
    </section>
  );
}

function RecentMovementsSection({
  movements,
}: {
  movements: DashboardMovement[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-medium">Stock movements</h2>
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
          <CardDescription>The newest entries in the stock ledger</CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <EmptyState
              title="No movements yet"
              description="Opening stock and every later change will be listed here."
            />
          ) : (
            <div className="divide-y">
              {movements.map((movement) => (
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
  );
}

export function DashboardView() {
  const { user } = useAuth();
  const summary = useApiItem<DashboardSummary>("/dashboard/summary");
  const data = summary.data;
  const firstName = user?.name.split(/\s+/)[0] ?? "there";
  const isInventoryManager = user?.role === "INVENTORY_MANAGER";
  const canSell = canAccess(user?.role, SALE_WRITE_ROLES);
  const canReceive = canAccess(user?.role, PURCHASE_WRITE_ROLES);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${firstName}`}
        description={`${formatSummaryDate(data?.date)} · ${
          isInventoryManager
            ? "Stock health first, with the newest ledger entries."
            : "Today's sales and stock health at a glance."
        }`}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={summary.reload}
              disabled={summary.isLoading}
            >
              <RefreshCw
                className={cn("size-3.5", summary.isLoading && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Link
              href="/alerts"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              Alerts
            </Link>
            {canSell ? (
              <Link
                href="/sales/new"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                New sale
              </Link>
            ) : canReceive ? (
              <Link
                href="/purchases/new"
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Receive stock
              </Link>
            ) : null}
          </>
        }
      />

      {summary.isLoading ? (
        <DashboardSkeleton inventoryManager={isInventoryManager} />
      ) : summary.error ? (
        <Card>
          <ErrorState message={summary.error} onRetry={summary.reload} />
        </Card>
      ) : data ? (
        <>
          {isInventoryManager ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Low stock"
                value={String(data.alerts.lowStock)}
                hint="Medicines below their reorder level"
                icon={Package}
                tone={data.alerts.lowStock > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Near expiry"
                value={String(data.alerts.nearExpiry)}
                hint="Batches inside the alert window"
                icon={Clock}
                tone={data.alerts.nearExpiry > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Expired"
                value={String(data.alerts.expired)}
                hint="Batches blocked from sale"
                icon={TriangleAlert}
                tone={data.alerts.expired > 0 ? "danger" : "default"}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Revenue today"
                value={formatMoney(data.todaySales.total)}
                hint={`${data.todaySales.count} sale${
                  data.todaySales.count === 1 ? "" : "s"
                } today`}
                icon={Wallet}
              />
              <StatCard
                label="Low stock"
                value={String(data.alerts.lowStock)}
                hint="Medicines below their reorder level"
                icon={Package}
                tone={data.alerts.lowStock > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Near expiry"
                value={String(data.alerts.nearExpiry)}
                hint="Batches inside the alert window"
                icon={Clock}
                tone={data.alerts.nearExpiry > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Expired"
                value={String(data.alerts.expired)}
                hint="Batches blocked from sale"
                icon={TriangleAlert}
                tone={data.alerts.expired > 0 ? "danger" : "default"}
              />
            </div>
          )}

          <div
            className={cn(
              "grid gap-6",
              !isInventoryManager && "xl:grid-cols-2",
            )}
          >
            {isInventoryManager ? (
              <RecentMovementsSection movements={data.recentMovements} />
            ) : (
              <>
                <RecentSalesSection sales={data.recentSales} />
                <RecentMovementsSection movements={data.recentMovements} />
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open reports
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DashboardSkeleton({
  inventoryManager,
}: {
  inventoryManager: boolean;
}) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          inventoryManager ? "xl:grid-cols-3" : "xl:grid-cols-4",
        )}
      >
        {Array.from({ length: inventoryManager ? 3 : 4 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className={cn("grid gap-6", !inventoryManager && "xl:grid-cols-2")}>
        {!inventoryManager ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : null}
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
