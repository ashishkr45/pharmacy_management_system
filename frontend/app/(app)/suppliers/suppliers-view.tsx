"use client";

import { useState } from "react";
import { ActiveBadge } from "@/components/catalogue/active-badge";
import { SupplierCreateDialog } from "@/components/catalogue/supplier-create-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildQuery } from "@/lib/api/client";
import type { Supplier } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { canAccess, CATALOGUE_WRITE_ROLES } from "@/lib/roles";

const STATUS_FILTER_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

const columns: DataTableColumn<Supplier>[] = [
  {
    key: "supplier",
    header: "Supplier",
    cell: (supplier) => (
      <div className="max-w-64 space-y-0.5">
        <p className="font-medium">{supplier.name}</p>
        {supplier.address ? (
          <p
            className="truncate text-[0.6875rem] text-muted-foreground"
            title={supplier.address}
          >
            {supplier.address}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "contact",
    header: "Contact",
    cell: (supplier) => (
      <div className="space-y-0.5">
        <p>{supplier.contactPerson ?? "—"}</p>
        {supplier.phone ? (
          <p className="text-[0.6875rem] text-muted-foreground">
            {supplier.phone}
          </p>
        ) : null}
        {supplier.email ? (
          <p className="text-[0.6875rem] text-muted-foreground">
            {supplier.email}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (supplier) => <ActiveBadge active={supplier.isActive} />,
  },
  {
    key: "added",
    header: "Added",
    cell: (supplier) => formatDate(supplier.createdAt),
    cellClassName: "text-muted-foreground",
  },
];

export function SuppliersView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const canManage = canAccess(user?.role, CATALOGUE_WRITE_ROLES);

  const path = `/suppliers${buildQuery({
    page,
    pageSize: 20,
    search,
    isActive: statusFilter === "all" ? undefined : statusFilter,
  })}`;
  const list = useApiList<Supplier>(path);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleStatusChange = (value: string | null) => {
    setStatusFilter(value ?? "all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Keep the supplier list current so purchases can be recorded against the right vendor."
        actions={
          canManage ? <SupplierCreateDialog onCreated={list.reload} /> : null
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={searchInput}
            onChange={handleSearch}
            placeholder="Search suppliers..."
            label="Search suppliers"
          />
          <div className="w-full sm:w-44">
            <Select
              items={STATUS_FILTER_ITEMS}
              value={statusFilter}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-full" aria-label="Filter suppliers by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_ITEMS.map((item) => (
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
            {list.data.meta.total} supplier
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(supplier) => supplier.id}
        caption="Medicine suppliers"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No suppliers found"
        emptyDescription={
          search || statusFilter !== "all"
            ? "Try adjusting the search or status filter."
            : "Create a supplier before recording purchases."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
