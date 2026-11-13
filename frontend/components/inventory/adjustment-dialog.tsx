"use client";

import { useState, type FormEvent } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { SearchInput } from "@/components/shared/search-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, buildQuery } from "@/lib/api/client";
import { invalidateApiCache } from "@/lib/api/cache";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import {
  ADJUSTMENT_REASONS,
  type Adjustment,
  type AdjustmentReason,
  type Batch,
} from "@/lib/api/types";
import {
  ADJUSTMENT_REASON_HINTS,
  ADJUSTMENT_REASON_LABELS,
} from "@/lib/adjustments";
import { formatDate } from "@/lib/format";
import { useApiList } from "@/lib/hooks/use-api-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const REASON_ITEMS = ADJUSTMENT_REASONS.map((reason) => ({
  label: ADJUSTMENT_REASON_LABELS[reason],
  value: reason,
}));

function BatchPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: Batch | null;
  onSelect: (batch: Batch) => void;
  disabled: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);
  const path = `/batches${buildQuery({
    page: 1,
    pageSize: 6,
    search,
  })}`;
  const list = useApiList<Batch>(path);

  return (
    <div className="space-y-2">
      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Medicine name or batch number..."
        label="Search batches to adjust"
      />

      <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-1">
        {list.isLoading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Searching batches...
          </p>
        ) : list.error ? (
          <div className="space-y-2 px-2 py-3">
            <p className="text-xs text-destructive">{list.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={list.reload}
            >
              Try again
            </Button>
          </div>
        ) : list.data && list.data.data.length > 0 ? (
          list.data.data.map((batch) => (
            <button
              key={batch.id}
              type="button"
              onClick={() => onSelect(batch)}
              aria-pressed={selected?.id === batch.id}
              disabled={disabled}
              className={cn(
                "flex w-full flex-col gap-1 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
                selected?.id === batch.id &&
                  "border-primary/40 bg-primary/5",
              )}
            >
              <span className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{batch.medicine.name}</span>
                <span className="text-[0.6875rem] text-muted-foreground">
                  {batch.quantityOnHand} {batch.medicine.unit} on hand
                </span>
              </span>
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                {batch.batchNo} · expires {formatDate(batch.expiryDate)}
                {batch.expired ? " · expired" : ""}
              </span>
            </button>
          ))
        ) : (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {search
              ? "No batch matches this search."
              : "No batches exist yet. Receive a purchase first."}
          </p>
        )}
      </div>

      {list.data ? (
        <p className="text-[0.6875rem] text-muted-foreground">
          Showing up to 6 batches, ordered by soonest expiry. Refine the search
          to find another batch.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Creates a signed stock adjustment.
 *
 * The server owns the final quantity check. The on-hand preview here is a
 * convenience only, and may be stale if another user changes the batch first.
 */
export function AdjustmentDialog() {
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const reset = () => {
    setBatch(null);
    setDelta("");
    setReason("");
    setNote("");
    setFieldErrors({});
    setFormError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) {
      return;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      reset();
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const trimmedDelta = delta.trim();
  const deltaNumber = /^-?\d+$/.test(trimmedDelta) ? Number(trimmedDelta) : NaN;
  const resultingQuantity =
    batch && Number.isInteger(deltaNumber)
      ? batch.quantityOnHand + deltaNumber
      : null;
  const reasonHint =
    reason && ADJUSTMENT_REASONS.includes(reason as AdjustmentReason)
      ? ADJUSTMENT_REASON_HINTS[reason as AdjustmentReason]
      : "Choose the reason that best explains the stock change.";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const reasonCode = ADJUSTMENT_REASONS.find((value) => value === reason);

    if (!batch) {
      nextErrors.batchId = "Choose the batch you want to adjust.";
    }
    if (!Number.isInteger(deltaNumber) || deltaNumber === 0) {
      nextErrors.delta = "Enter a non-zero whole number, e.g. -2 or 5.";
    } else if (batch && batch.quantityOnHand + deltaNumber < 0) {
      nextErrors.delta = `Batch ${batch.batchNo} only has ${batch.quantityOnHand} on hand.`;
    }
    if (!reasonCode) {
      nextErrors.reasonCode = "Choose an adjustment reason.";
    }
    if (reasonCode === "OTHER" && note.trim() === "") {
      nextErrors.note = "A note is required when the reason is Other.";
    }
    if (note.trim().length > 500) {
      nextErrors.note = "The note must be 500 characters or fewer.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !batch || !reasonCode) {
      setFormError(null);
      return;
    }

    setPending(true);
    setFormError(null);

    try {
      const created = await apiRequest<Adjustment>("/adjustments", {
        method: "POST",
        body: {
          batchId: batch.id,
          delta: deltaNumber,
          reasonCode,
          note: note.trim() || undefined,
        },
      });

      invalidateApiCache([
        "/adjustments",
        "/batches",
        "/stock-movements",
        "/alerts",
        "/dashboard",
        "/reports",
        "/audit-logs",
      ]);

      toast.success("Stock adjusted", {
        description: `${created.delta > 0 ? "+" : ""}${created.delta} on batch ${
          batch.batchNo
        }. New on-hand quantity: ${created.batch.quantityOnHand}.`,
      });
      setOpen(false);
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The stock adjustment could not be recorded.",
      );
      setFieldErrors(parsed.fields);
      const hasMappedField = Boolean(
        parsed.fields.batchId ||
          parsed.fields.delta ||
          parsed.fields.reasonCode ||
          parsed.fields.note,
      );
      setFormError(hasMappedField ? null : parsed.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button type="button" onClick={() => handleOpenChange(true)}>
        <SlidersHorizontal aria-hidden="true" />
        Adjust stock
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Adjust batch stock</DialogTitle>
            <DialogDescription>
              Record damaged, expired, lost or counted stock. The adjustment and
              its ledger movement are saved together, and the server rejects a
              result below zero.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not adjust stock</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(fieldErrors.batchId)}>
              <FieldLabel>Batch</FieldLabel>
              <BatchPicker
                selected={batch}
                onSelect={(nextBatch) => {
                  setBatch(nextBatch);
                  clearFieldError("batchId");
                  clearFieldError("delta");
                }}
                disabled={pending}
              />
              <FieldError>{fieldErrors.batchId}</FieldError>
            </Field>

            {batch ? (
              <div className="rounded-lg border bg-card p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{batch.medicine.name}</p>
                    <p className="font-mono text-[0.625rem] text-muted-foreground">
                      {batch.batchNo} · expires {formatDate(batch.expiryDate)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {batch.quantityOnHand} {batch.medicine.unit} on hand
                  </Badge>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(fieldErrors.delta)}>
                <FieldLabel htmlFor="adjustment-delta">
                  Change in quantity
                </FieldLabel>
                <Input
                  id="adjustment-delta"
                  type="number"
                  step={1}
                  value={delta}
                  onChange={(event) => {
                    setDelta(event.target.value);
                    clearFieldError("delta");
                  }}
                  placeholder="e.g. -2 or 5"
                  aria-invalid={Boolean(fieldErrors.delta)}
                  aria-describedby={
                    fieldErrors.delta
                      ? "adjustment-delta-error"
                      : "adjustment-delta-help"
                  }
                  disabled={pending}
                />
                <FieldDescription id="adjustment-delta-help">
                  Positive adds found stock; negative removes stock. Never zero.
                </FieldDescription>
                <FieldError id="adjustment-delta-error">
                  {fieldErrors.delta}
                </FieldError>
              </Field>

              <Field>
                <FieldLabel>Resulting quantity</FieldLabel>
                <div
                  className={cn(
                    "flex h-7 items-center rounded-md border bg-muted/30 px-2 text-sm tabular-nums",
                    resultingQuantity !== null &&
                      resultingQuantity < 0 &&
                      "border-destructive/40 text-destructive",
                  )}
                >
                  {resultingQuantity === null ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    `${resultingQuantity} ${batch?.medicine.unit ?? ""}`
                  )}
                </div>
                <FieldDescription>
                  Preview only; the server rechecks the locked batch.
                </FieldDescription>
              </Field>
            </div>

            <Field data-invalid={Boolean(fieldErrors.reasonCode)}>
              <FieldLabel htmlFor="adjustment-reason">Reason</FieldLabel>
              <Select
                items={REASON_ITEMS}
                value={reason}
                onValueChange={(value) => {
                  setReason(value ?? "");
                  clearFieldError("reasonCode");
                  clearFieldError("note");
                }}
                disabled={pending}
              >
                <SelectTrigger
                  id="adjustment-reason"
                  className="w-full"
                  aria-label="Adjustment reason"
                  aria-invalid={Boolean(fieldErrors.reasonCode)}
                >
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{reasonHint}</FieldDescription>
              <FieldError>{fieldErrors.reasonCode}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.note)}>
              <FieldLabel htmlFor="adjustment-note">
                Note{" "}
                {reason === "OTHER" ? (
                  <span className="text-destructive">(required)</span>
                ) : (
                  <span className="text-muted-foreground">(optional)</span>
                )}
              </FieldLabel>
              <Textarea
                id="adjustment-note"
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  clearFieldError("note");
                }}
                rows={3}
                maxLength={500}
                required={reason === "OTHER"}
                placeholder="e.g. Two strips damaged in transit; removed from sellable stock."
                aria-invalid={Boolean(fieldErrors.note)}
                aria-describedby={
                  fieldErrors.note ? "adjustment-note-error" : undefined
                }
                disabled={pending}
              />
              <FieldError id="adjustment-note-error">
                {fieldErrors.note}
              </FieldError>
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending} aria-busy={pending}>
                {pending ? "Saving adjustment..." : "Save adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
