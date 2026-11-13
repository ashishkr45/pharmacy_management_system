"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { SaleStatusBadge } from "@/components/sales/sale-status-badge";
import { buttonVariants } from "@/components/ui/button";
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
  SALE_STATUSES,
  type Sale,
} from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { canAccess, SALE_WRITE_ROLES } from "@/lib/roles";
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from "@/lib/sales";

const STATUS_ITEMS = [
  { label: "All statuses", value: "all" },
  ...SALE_STATUSES.map((status) => ({
    label: SALE_STATUS_LABELS[status],
    value: status,
  })),
];

function totalUnits(sale: Sale): number {
  return sale.items.reduce((sum, item) => sum + item.quantity, 0);
}

export function SalesView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const canSell = canAccess(user?.role, SALE_WRITE_ROLES);

  const hasFilters =
    searchInput.trim() !== "" ||
    statusFilter !== "all" ||
    from !== "" ||
    to !== "";

  const path = `/sales${buildQuery({
    page,
    pageSize: 20,
    search,
    status: statusFilter === "all" ? undefined : statusFilter,
    from: from || undefined,
    to: to || undefined,
  })}`;
  const list = useApiList<Sale>(path);

  const columns: DataTableColumn<Sale>[] = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (sale) => (
        <Link
          href={`/sales/${sale.id}`}
          className="font-mono text-[0.6875rem] font-medium text-primary hover:underline"
        >
          {sale.invoiceNo}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (sale) => (
        <div className="max-w-44 space-y-0.5">
          <p className="truncate font-medium">
            {sale.customerName ?? "Walk-in customer"}
          </p>
          {sale.customerPhone ? (
            <p className="text-[0.6875rem] text-muted-foreground">
              {sale.customerPhone}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Sold",
      cell: (sale) => (
        <div className="space-y-0.5">
          <p className="whitespace-nowrap">{formatDateTime(sale.createdAt)}</p>
          <p className="text-[0.6875rem] text-muted-foreground">
            by {sale.createdBy.name}
          </p>
        </div>
      ),
      cellClassName: "text-muted-foreground",
    },
    {
      key: "items",
      header: "Items",
      cell: (sale) => (
        <div className="space-y-0.5">
          <p className="tabular-nums">
            {totalUnits(sale)} unit{totalUnits(sale) === 1 ? "" : "s"}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">
            {sale.items.length} batch line
            {sale.items.length === 1 ? "" : "s"}
          </p>
        </div>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "payment",
      header: "Payment",
      cell: (sale) => PAYMENT_METHOD_LABELS[sale.paymentMethod],
      cellClassName: "text-muted-foreground",
    },
    {
      key: "status",
      header: "Status",
      cell: (sale) => <SaleStatusBadge status={sale.status} />,
    },
    {
      key: "total",
      header: "Total",
      cell: (sale) => formatMoney(sale.total),
      headerClassName: "text-right",
      cellClassName: "text-right font-medium tabular-nums",
    },
    {
      key: "action",
      header: "",
      cell: (sale) => (
        <Link
          href={`/sales/${sale.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          View
        </Link>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
  ];

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleStatusChange = (value: string | null) => {
    setStatusFilter(value ?? "all");
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        description="Counter invoices with their server-allocated FEFO batch lines, payment label and return status."
        actions={
          canSell ? (
            <Link href="/sales/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              New sale
            </Link>
          ) : null
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={searchInput}
              onChange={handleSearch}
              placeholder="Invoice, customer or phone..."
              label="Search sales by invoice, customer name or phone"
            />

            <div className="w-full sm:w-44">
              <Select
                items={STATUS_ITEMS}
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label="Filter sales by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                aria-label="Sales from date"
                className="w-full sm:w-36"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                aria-label="Sales to date"
                className="w-full sm:w-36"
              />
            </div>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
                Clear filters
              </button>
            ) : null}
          </div>

          {list.data ? (
            <p className="text-xs text-muted-foreground">
              {list.data.meta.total} sale
              {list.data.meta.total === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(sale) => sale.id}
        caption="Sales invoices"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No sales found"
        emptyDescription={
          hasFilters
            ? "Try adjusting the search, status or date range."
            : canSell
              ? "Complete a sale at the counter to create the first invoice."
              : "No invoices have been created yet."
        }
        emptyAction={
          canSell && !hasFilters ? (
            <Link href="/sales/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              New sale
            </Link>
          ) : null
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
