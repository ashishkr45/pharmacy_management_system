"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buildQuery } from "@/lib/api/client";
import type { AuditLogEntry } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

function snapshotText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function Snapshot({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const text = snapshotText(value);

  if (!text) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[0.625rem] leading-relaxed whitespace-pre-wrap break-all">{text}</pre>
    </div>
  );
}

function ChangeSnapshot({ entry }: { entry: AuditLogEntry }) {
  const before = snapshotText(entry.before);
  const after = snapshotText(entry.after);

  if (!before && !after) {
    return <span className="text-muted-foreground">No snapshot</span>;
  }

  return (
    <details className="max-w-md">
      <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
        View before / after
      </summary>
      <div className="mt-1.5 space-y-1.5 whitespace-normal">
        {before ? <Snapshot label="Before" value={entry.before} /> : null}
        {after ? <Snapshot label="After" value={entry.after} /> : null}
      </div>
    </details>
  );
}

const columns: DataTableColumn<AuditLogEntry>[] = [
  {
    key: "createdAt",
    header: "When",
    cell: (entry) => (
      <div className="space-y-0.5">
        <p className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</p>
        <p
          className="text-[0.6875rem] text-muted-foreground"
          title={entry.user.email}
        >
          by {entry.user.name}
        </p>
      </div>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    key: "action",
    header: "Action",
    cell: (entry) => <Badge variant="outline">{entry.action}</Badge>,
  },
  {
    key: "entity",
    header: "Entity",
    cell: (entry) => (
      <div className="space-y-1">
        <Badge variant="secondary">{entry.entityType}</Badge>
        <p className="font-mono text-[0.6875rem] text-muted-foreground">
          #{entry.entityId}
        </p>
      </div>
    ),
  },
  {
    key: "changes",
    header: "Changes",
    cell: (entry) => <ChangeSnapshot entry={entry} />,
    cellClassName: "whitespace-normal",
  },
];

export function AuditLogsView() {
  const [searchInput, setSearchInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [entityInput, setEntityInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const search = useDebouncedValue(searchInput.trim(), 300);
  const action = useDebouncedValue(actionInput.trim(), 300);
  const entityType = useDebouncedValue(entityInput.trim(), 300);
  const rangeInvalid = from !== "" && to !== "" && from > to;

  const hasFilters =
    searchInput.trim() !== "" ||
    actionInput.trim() !== "" ||
    entityInput.trim() !== "" ||
    from !== "" ||
    to !== "";

  const path = `/audit-logs${buildQuery({
    page,
    pageSize: 20,
    search,
    action,
    entityType,
    from: from || undefined,
    to: to || undefined,
  })}`;
  const list = useApiList<AuditLogEntry>(path);

  const clearFilters = () => {
    setSearchInput("");
    setActionInput("");
    setEntityInput("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Admin-only, newest first. Every material action records who changed what, the affected entity and a before/after snapshot where available."
      />

      <div className="space-y-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                setPage(1);
              }}
              placeholder="Action, entity or ID..."
              label="Search audit logs by action, entity or entity ID"
            />

            <label className="flex w-full items-center gap-1.5 text-xs text-muted-foreground sm:w-auto">
              <span>Action</span>
              <Input
                value={actionInput}
                onChange={(event) => {
                  setActionInput(event.target.value);
                  setPage(1);
                }}
                placeholder="e.g. UPDATE"
                maxLength={50}
                className="w-full sm:w-32"
                aria-label="Filter audit logs by action"
              />
            </label>

            <label className="flex w-full items-center gap-1.5 text-xs text-muted-foreground sm:w-auto">
              <span>Entity</span>
              <Input
                value={entityInput}
                onChange={(event) => {
                  setEntityInput(event.target.value);
                  setPage(1);
                }}
                placeholder="e.g. SALE"
                maxLength={50}
                className="w-full sm:w-32"
                aria-label="Filter audit logs by entity type"
              />
            </label>

            <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>From</span>
                <Input
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Audit logs from date"
                  aria-invalid={rangeInvalid}
                  className="flex-1 sm:w-32 sm:flex-none"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>To</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Audit logs to date"
                  aria-invalid={rangeInvalid}
                  className="flex-1 sm:w-32 sm:flex-none"
                />
              </label>
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
              {list.data.meta.total} entr{list.data.meta.total === 1 ? "y" : "ies"}
            </p>
          ) : null}
        </div>

        {rangeInvalid ? (
          <p role="alert" className="text-xs text-destructive">
            From must be on or before To. The current filters will return no
            rows until the dates are corrected.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Snapshots may contain the changed fields only, not a full record. The
          audit trail is append-only; settings changes and stock-critical
          actions are recorded in the same transaction as the change.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={list.data?.data ?? []}
        getRowKey={(entry) => entry.id}
        caption="Admin audit trail"
        isLoading={list.isLoading}
        error={list.error}
        onRetry={list.reload}
        emptyTitle="No audit entries found"
        emptyDescription={
          hasFilters
            ? "Try clearing or widening the action, entity or date filters."
            : "Material actions such as catalogue changes, sales, returns, adjustments and settings updates will appear here."
        }
        pagination={list.data?.meta}
        onPageChange={setPage}
      />
    </div>
  );
}
