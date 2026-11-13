"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildQuery } from "@/lib/api/client";
import type { Purchase, Supplier } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatMoney } from "@/lib/format";
import {
  REFERENCE_DATA_STALE_TIME,
  useApiList,
} from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { canAccess, PURCHASE_WRITE_ROLES } from "@/lib/roles";

const columns: DataTableColumn<Purchase>[] = [
  {
    key: "invoice",
    header: "Supplier invoice",
    cell: (purchase) => (
      <Link
        href={`/purchases/${purchase.id}`}
        className="font-mono text-[0.6875rem] font-medium text-primary hover:underline"
      >
        {purchase.supplierInvoiceNo}
      </Link>
    ),
  },
  {
    key: "supplier",
    header: "Supplier",
    cell: (purchase) => purchase.supplier.name,
  },
  {
    key: "purchaseDate",
    header: "Purchase date",
    cell: (purchase) => formatDate(purchase.purchaseDate),
    cellClassName: "text-muted-foreground",
  },
  {
    key: "items",
    header: "Items",
    cell: (purchase) => (
      <span className="tabular-nums">{purchase.items.length}</span>
    ),
    headerClassName: "text-right",
    cellClassName: "text-right",
  },
  {
    key: "total",
    header: "Total cost",
    cell: (purchase) => formatMoney(purchase.totalCost),
    headerClassName: "text-right",
    cellClassName: "text-right tabular-nums",
  },
  {
    key: "recorded",
    header: "Recorded",
    cell: (purchase) => (
      <div className="space-y-0.5">
        <p>{formatDate(purchase.createdAt)}</p>
        <p className="text-[0.6875rem] text-muted-foreground">
          {purchase.createdBy.name}
        </p>
      </div>
    ),
  },
];

export function PurchasesView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const canManage = canAccess(user?.role, PURCHASE_WRITE_ROLES);

  const suppliersList = useApiList<Supplier>("/suppliers?pageSize=100", {
    staleTime: REFERENCE_DATA_STALE_TIME,
  });
  const supplierItems = useMemo(
    () => [
      { label: "All suppliers", value: "all" },
      ...(suppliersList.data?.data ?? []).map((supplier) => ({
        label: supplier.name,
        value: String(supplier.id),
      })),
    ],
    [suppliersList.data],
  );

  const path = `/purchases${buildQuery({
    page,
    pageSize: 20,
    search,
    supplierId: supplierFilter === "all" ? undefined : supplierFilter,
  })}`;
  const list = useApiList<Purchase>(path);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleSupplierChange = (value: string | null) => {
    setSupplierFilter(value ?? "all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        description="Receive stock into batches, record supplier invoices and write the matching ledger entries."
        actions={
          canManage ? (
            <Link href="/purchases/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              New purchase
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={searchInput}
            onChange={handleSearch}
            placeholder="Search invoice no..."
            label="Search purchases by supplier invoice"
          />
          <div className="w-full sm:w-56">
            <Select
              items={supplierItems}
              value={supplierFilter}
              onValueChange={handleSupplierChange}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter purchases by supplier"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplierItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} purchase
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(purchase) => purchase.id}
        caption="Received purchase invoices"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No purchases found"
        emptyDescription={
          search || supplierFilter !== "all"
            ? "Try adjusting the search or supplier filter."
            : "Receive your first supplier invoice to add stock to inventory."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
