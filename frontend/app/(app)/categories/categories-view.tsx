"use client";

import { useState } from "react";
import { CategoryCreateDialog } from "@/components/catalogue/category-create-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { buildQuery } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { canAccess, CATALOGUE_WRITE_ROLES } from "@/lib/roles";

const columns: DataTableColumn<Category>[] = [
  {
    key: "name",
    header: "Category",
    cell: (category) => (
      <span className="font-medium">{category.name}</span>
    ),
  },
  {
    key: "medicines",
    header: "Medicines",
    cell: (category) => (
      <span className="tabular-nums">{category.medicineCount}</span>
    ),
  },
  {
    key: "created",
    header: "Created",
    cell: (category) => formatDate(category.createdAt),
    cellClassName: "text-muted-foreground",
  },
];

export function CategoriesView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput.trim(), 300);
  const canManage = canAccess(user?.role, CATALOGUE_WRITE_ROLES);

  const path = `/categories${buildQuery({
    page,
    pageSize: 20,
    search,
  })}`;
  const list = useApiList<Category>(path);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group medicines into categories and find them quickly when building the catalogue."
        actions={
          canManage ? <CategoryCreateDialog onCreated={list.reload} /> : null
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={searchInput}
          onChange={handleSearch}
          placeholder="Search categories..."
          label="Search categories"
        />
        {list.data ? (
          <p className="text-xs text-muted-foreground">
            {list.data.meta.total} categor
            {list.data.meta.total === 1 ? "y" : "ies"}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(category) => category.id}
        caption="Medicine categories"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No categories found"
        emptyDescription={
          search
            ? "Try a different search term."
            : "Create a category to start grouping medicines."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
