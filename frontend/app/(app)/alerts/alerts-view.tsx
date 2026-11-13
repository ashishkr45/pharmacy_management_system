"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  Package,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { ExpiryPanel } from "@/components/inventory/expiry-panel";
import { LowStockPanel } from "@/components/inventory/low-stock-panel";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { AlertCounts } from "@/lib/api/types";
import { useApiItem } from "@/lib/hooks/use-api-item";
import { cn } from "@/lib/utils";

type AlertTab = "low" | "near-expiry" | "expired";

interface AlertSummaryResponse {
  alerts: AlertCounts;
}

const ALERT_TABS: Array<{
  value: AlertTab;
  label: string;
  countKey: keyof AlertCounts;
  description: string;
  icon: LucideIcon;
  tone: "warning" | "danger";
}> = [
  {
    value: "low",
    label: "Low stock",
    countKey: "lowStock",
    description: "Medicines below their reorder level",
    icon: Package,
    tone: "warning",
  },
  {
    value: "near-expiry",
    label: "Near expiry",
    countKey: "nearExpiry",
    description: "Batches inside the configured expiry window",
    icon: Clock,
    tone: "warning",
  },
  {
    value: "expired",
    label: "Expired",
    countKey: "expired",
    description: "Expired batches still holding stock",
    icon: TriangleAlert,
    tone: "danger",
  },
];

/**
 * The alerts workspace reuses the same server-paginated panels as inventory,
 * so counts and lists always follow the backend rules (for example low stock
 * counts only unexpired stock).
 */
export function AlertsView() {
  const [tab, setTab] = useState<AlertTab>("low");
  const summary = useApiItem<AlertSummaryResponse>("/dashboard/summary");
  const activeTab = ALERT_TABS.find((item) => item.value === tab) ?? ALERT_TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Low stock, near expiry and expired stock calculated by the API. Open inventory to inspect a batch or adjust stock."
        actions={
          <Link
            href="/inventory"
            className={buttonVariants({ variant: "outline" })}
          >
            Open inventory
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {ALERT_TABS.map((item) => {
          const Icon = item.icon;
          const count = summary.data?.alerts[item.countKey];
          const active = tab === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              aria-pressed={active}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                active && "border-primary/40 bg-primary/5",
              )}
            >
              <span className="min-w-0 space-y-1">
                <span className="block text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {item.label}
                </span>
                <span className="flex items-baseline gap-2">
                  {summary.isLoading ? (
                    <span
                      className="inline-block h-8 w-10 animate-pulse rounded-md bg-muted"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
                      {count ?? "—"}
                    </span>
                  )}
                </span>
                <span className="block text-[0.6875rem] text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  item.tone === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      {summary.error ? (
        <p className="text-xs text-muted-foreground" role="status">
          Live counts are unavailable right now. The lists below still load
          directly from their alert endpoints.
        </p>
      ) : null}

      <section className="space-y-4" aria-live="polite">
        <div>
          <h2 className="font-heading text-sm font-medium">
            {activeTab.label}
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            {activeTab.description}. Search and pagination are applied by the
            server.
          </p>
        </div>

        {tab === "low" ? (
          <LowStockPanel />
        ) : (
          <ExpiryPanel mode={tab === "near-expiry" ? "near" : "expired"} />
        )}
      </section>
    </div>
  );
}
