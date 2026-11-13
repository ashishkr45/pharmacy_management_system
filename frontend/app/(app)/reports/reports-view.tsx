"use client";

import { useState } from "react";
import {
  Boxes,
  Clock,
  ReceiptText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { ExpiryReportView } from "@/components/reports/expiry-report";
import { ReconciliationReportView } from "@/components/reports/reconciliation-report";
import { SalesReportView } from "@/components/reports/sales-report";
import { StockValuationReportView } from "@/components/reports/stock-valuation-report";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import {
  canAccess,
  SALES_REPORT_ROLES,
  STOCK_REPORT_ROLES,
} from "@/lib/roles";

type ReportTab = "sales" | "valuation" | "expiry" | "reconciliation";

interface ReportTabDefinition {
  value: ReportTab;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: readonly ("ADMIN" | "PHARMACIST" | "INVENTORY_MANAGER")[];
}

const REPORT_TABS: readonly ReportTabDefinition[] = [
  {
    value: "sales",
    label: "Sales",
    description:
      "Gross sales, tax, returns and a per-day breakdown for the selected range.",
    icon: ReceiptText,
    roles: SALES_REPORT_ROLES,
  },
  {
    value: "valuation",
    label: "Stock valuation",
    description:
      "Current batch quantities at cost and retail value, including expiry flags.",
    icon: Boxes,
    roles: STOCK_REPORT_ROLES,
  },
  {
    value: "expiry",
    label: "Expiry",
    description:
      "Expired and near-expiry stock grouped by medicine, with cost at risk.",
    icon: Clock,
    roles: STOCK_REPORT_ROLES,
  },
  {
    value: "reconciliation",
    label: "Reconciliation",
    description:
      "Rebuild batch balances from the ledger and compare them with current stock.",
    icon: ShieldCheck,
    roles: STOCK_REPORT_ROLES,
  },
];

export function ReportsView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<ReportTab>(() =>
    user?.role === "INVENTORY_MANAGER" ? "valuation" : "sales",
  );

  const allowedTabs = REPORT_TABS.filter((item) =>
    canAccess(user?.role, item.roles),
  );
  const activeTab =
    allowedTabs.find((item) => item.value === tab) ?? allowedTabs[0];

  const description =
    user?.role === "INVENTORY_MANAGER"
      ? "Stock valuation, expiry exposure and ledger reconciliation. Sales reports are restricted to counter roles."
      : user?.role === "PHARMACIST"
        ? "Sales reporting for the counter. Stock and ledger reports are restricted to stock roles."
        : "Sales, stock, expiry and ledger reports. Every figure is calculated by the API.";

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description={description} />

      {allowedTabs.length === 0 || !activeTab ? (
        <Card>
          <EmptyState
            title="No reports available"
            description="Your role does not have access to any report type."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            <div
              role="group"
              aria-label="Report type"
              className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
            >
              {allowedTabs.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.value}
                    type="button"
                    size="sm"
                    variant={activeTab.value === item.value ? "secondary" : "ghost"}
                    aria-pressed={activeTab.value === item.value}
                    onClick={() => setTab(item.value)}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeTab.description}
            </p>
          </div>

          <section aria-live="polite">
            {activeTab.value === "sales" ? <SalesReportView /> : null}
            {activeTab.value === "valuation" ? (
              <StockValuationReportView />
            ) : null}
            {activeTab.value === "expiry" ? <ExpiryReportView /> : null}
            {activeTab.value === "reconciliation" ? (
              <ReconciliationReportView />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
