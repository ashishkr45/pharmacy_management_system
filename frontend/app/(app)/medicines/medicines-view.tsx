"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { ActiveBadge } from "@/components/catalogue/active-badge";
import { MedicineFormDialog } from "@/components/catalogue/medicine-form-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildQuery } from "@/lib/api/client";
import type { Category, Medicine } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatMoney } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { canAccess, CATALOGUE_WRITE_ROLES } from "@/lib/roles";

const STATUS_FILTER_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

export function MedicinesView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const canManage = canAccess(user?.role, CATALOGUE_WRITE_ROLES);

  const categoriesList = useApiList<Category>("/categories?pageSize=100");
  const categories = useMemo(
    () => categoriesList.data?.data ?? [],
    [categoriesList.data],
  );

  const categoryItems = useMemo(
    () => [
      { label: "All categories", value: "all" },
      ...categories.map((category) => ({
        label: category.name,
        value: String(category.id),
      })),
    ],
    [categories],
  );

  const path = `/medicines${buildQuery({
    page,
    pageSize: 20,
    search,
    categoryId: categoryFilter === "all" ? undefined : categoryFilter,
    isActive: statusFilter === "all" ? undefined : statusFilter,
  })}`;
  const list = useApiList<Medicine>(path);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string | null) => {
    setCategoryFilter(value ?? "all");
    setPage(1);
  };

  const handleStatusChange = (value: string | null) => {
    setStatusFilter(value ?? "all");
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (medicine: Medicine) => {
    setEditing(medicine);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
    }
  };

  const columns: DataTableColumn<Medicine>[] = [
    {
      key: "medicine",
      header: "Medicine",
      cell: (medicine) => (
        <div className="max-w-64 space-y-0.5">
          <p className="font-medium">{medicine.name}</p>
          {medicine.genericName ? (
            <p className="truncate text-[0.6875rem] text-muted-foreground">
              {medicine.genericName}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      cell: (medicine) => (
        <span className="font-mono text-[0.6875rem]">{medicine.sku}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (medicine) => medicine.category.name,
    },
    {
      key: "unit",
      header: "Unit",
      cell: (medicine) => medicine.unit,
    },
    {
      key: "reorder",
      header: "Reorder",
      cell: (medicine) => (
        <span className="tabular-nums">{medicine.reorderLevel}</span>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    },
    {
      key: "tax",
      header: "Tax",
      cell: (medicine) =>
        medicine.taxRate ? `${medicine.taxRate}%` : "Default",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "price",
      header: "Default price",
      cell: (medicine) =>
        medicine.defaultSalePrice
          ? formatMoney(medicine.defaultSalePrice)
          : "—",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    {
      key: "status",
      header: "Status",
      cell: (medicine) => <ActiveBadge active={medicine.isActive} />,
    },
  ];

  if (canManage) {
    columns.push({
      key: "actions",
      header: "Actions",
      cell: (medicine) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => openEdit(medicine)}
            aria-label={`Edit ${medicine.name}`}
          >
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      ),
      headerClassName: "text-right",
      cellClassName: "text-right",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicines"
        description="Search the catalogue, create medicines and update prices, tax rates and active status."
        actions={
          canManage ? (
            <Button type="button" onClick={openCreate}>
              <Plus aria-hidden="true" />
              New medicine
            </Button>
          ) : null
        }
      />

      {categoriesList.error ? (
        <Alert variant="destructive">
          <AlertTitle>Categories unavailable</AlertTitle>
          <AlertDescription>
            Medicines can still be listed, but creating or editing one needs
            the category list. {categoriesList.error}
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={categoriesList.reload}
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={searchInput}
            onChange={handleSearch}
            placeholder="Search medicines..."
            label="Search medicines"
          />
          <div className="w-full sm:w-44">
            <Select
              items={categoryItems}
              value={categoryFilter}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter medicines by category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Select
              items={STATUS_FILTER_ITEMS}
              value={statusFilter}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter medicines by status"
              >
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
            {list.data.meta.total} medicine
            {list.data.meta.total === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(medicine) => medicine.id}
        caption="Medicine catalogue"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No medicines found"
        emptyDescription={
          search || categoryFilter !== "all" || statusFilter !== "all"
            ? "Try adjusting the search or filters."
            : "Create the first medicine to start the catalogue."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />

      <MedicineFormDialog
        key={dialogOpen ? (editing?.id ?? "new") : "closed"}
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        medicine={editing}
        categories={categories}
        onSaved={list.reload}
      />
    </div>
  );
}
