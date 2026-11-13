"use client";

import { useState, type FormEvent } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api/client";
import { invalidateApiCache } from "@/lib/api/cache";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { CreateSaleReturnResult, Sale } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

interface ReturnDialogProps {
  sale: Sale;
}

/**
 * Records one return request for a completed (or partially returned) sale.
 *
 * The client only collects a quantity and a reason. The server locks the sale
 * items, checks the remaining quantity and writes the RETURN ledger entries.
 */
export function ReturnDialog({ sale }: ReturnDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const returnableLines = sale.items.filter(
    (line) => line.quantity - line.returnedQuantity > 0,
  );

  const reset = () => {
    setQuantities({});
    setReason("");
    setLineErrors({});
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

  const setLineQuantity = (saleItemId: number, value: string) => {
    setQuantities((previous) => ({ ...previous, [saleItemId]: value }));
    setLineErrors((previous) => {
      if (!(saleItemId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[saleItemId];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextLineErrors: Record<number, string> = {};
    const items: Array<{ saleItemId: number; quantity: number }> = [];

    for (const line of returnableLines) {
      const raw = (quantities[line.id] ?? "").trim();
      if (raw === "" || raw === "0") {
        continue;
      }

      if (!/^\d+$/.test(raw)) {
        nextLineErrors[line.id] = "Use a whole number of units.";
        continue;
      }

      const quantity = Number(raw);
      const remaining = line.quantity - line.returnedQuantity;
      if (quantity > remaining) {
        nextLineErrors[line.id] = `Only ${remaining} unit${
          remaining === 1 ? "" : "s"
        } remain on this line.`;
        continue;
      }

      items.push({ saleItemId: line.id, quantity });
    }

    const trimmedReason = reason.trim();
    const nextFieldErrors: FieldErrors = {};

    if (trimmedReason.length < 3) {
      nextFieldErrors.reason = "Enter at least 3 characters explaining the return.";
    } else if (trimmedReason.length > 500) {
      nextFieldErrors.reason = "The reason must be 500 characters or fewer.";
    }

    if (items.length === 0 && Object.keys(nextLineErrors).length === 0) {
      nextFieldErrors.items = "Choose at least one line and quantity to return.";
    }

    setLineErrors(nextLineErrors);
    setFieldErrors(nextFieldErrors);

    if (
      Object.keys(nextLineErrors).length > 0 ||
      Object.keys(nextFieldErrors).length > 0
    ) {
      setFormError(null);
      return;
    }

    setPending(true);
    setFormError(null);

    try {
      const result = await apiRequest<CreateSaleReturnResult>(
        `/sales/${sale.id}/returns`,
        {
          method: "POST",
          body: {
            reason: trimmedReason,
            items,
          },
        },
      );

      const returnedUnits = result.returns.reduce(
        (sum, record) => sum + record.quantity,
        0,
      );

      // A return changes stock, sale status, alerts, reports, audit history
      // and the return history shown on this page.
      invalidateApiCache([
        "/sales",
        "/returns",
        "/batches",
        "/stock-movements",
        "/adjustments",
        "/alerts",
        "/dashboard",
        "/reports",
        "/audit-logs",
      ]);

      toast.success("Return recorded", {
        description: `${returnedUnits} unit${
          returnedUnits === 1 ? "" : "s"
        } returned against ${sale.invoiceNo}.`,
      });
      setOpen(false);
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The return could not be recorded.",
      );
      setFieldErrors(parsed.fields);
      const hasMappedField = Boolean(
        parsed.fields.reason || parsed.fields.items,
      );
      setFormError(hasMappedField ? null : parsed.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => handleOpenChange(true)}
      >
        <RotateCcw aria-hidden="true" />
        Return items
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Return items from {sale.invoiceNo}</DialogTitle>
            <DialogDescription>
              Returned units go back to their original batch, never through
              FEFO. The server verifies every quantity and records the reason in
              the stock ledger and audit trail.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not record return</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium">Returnable lines</p>
                <p className="text-xs/relaxed text-muted-foreground">
                  Leave a quantity blank or at zero to keep that line.
                </p>
              </div>

              {returnableLines.length === 0 ? (
                <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Every line on this sale has already been fully returned.
                </p>
              ) : (
                <div className="space-y-2">
                  {returnableLines.map((line) => {
                    const remaining = line.quantity - line.returnedQuantity;
                    const inputId = `return-quantity-${line.id}`;
                    const errorId = `${inputId}-error`;

                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">{line.medicine.name}</p>
                            <p className="font-mono text-[0.625rem] text-muted-foreground">
                              {line.medicine.sku} · batch{" "}
                              {line.batch.batchNo} · expires{" "}
                              {formatDate(line.batch.expiryDate)}
                            </p>
                            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                              Sold {line.quantity} {line.medicine.unit}
                              {line.quantity === 1 ? "" : "s"} · already
                              returned {line.returnedQuantity}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit">
                            {remaining} returnable
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <Field
                            data-invalid={Boolean(lineErrors[line.id])}
                            className="w-32"
                          >
                            <FieldLabel htmlFor={inputId}>
                              Return quantity
                            </FieldLabel>
                            <Input
                              id={inputId}
                              type="number"
                              min={0}
                              max={remaining}
                              step={1}
                              inputMode="numeric"
                              value={quantities[line.id] ?? ""}
                              onChange={(event) =>
                                setLineQuantity(line.id, event.target.value)
                              }
                              aria-invalid={Boolean(lineErrors[line.id])}
                              aria-describedby={
                                lineErrors[line.id] ? errorId : undefined
                              }
                              disabled={pending}
                            />
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setLineQuantity(line.id, String(remaining))
                            }
                            disabled={pending}
                          >
                            Return all
                          </Button>
                        </div>

                        {lineErrors[line.id] ? (
                          <p
                            id={errorId}
                            role="alert"
                            className="mt-1 text-xs text-destructive"
                          >
                            {lineErrors[line.id]}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <FieldError>{fieldErrors.items}</FieldError>
            </div>

            <Field data-invalid={Boolean(fieldErrors.reason)}>
              <FieldLabel htmlFor="return-reason">
                Reason <span className="text-destructive">(required)</span>
              </FieldLabel>
              <Textarea
                id="return-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setFieldErrors((previous) => {
                    if (!previous.reason) {
                      return previous;
                    }
                    const next = { ...previous };
                    delete next.reason;
                    return next;
                  });
                }}
                rows={3}
                minLength={3}
                maxLength={500}
                required
                placeholder="e.g. Customer reported an adverse reaction; units unopened and resellable."
                aria-invalid={Boolean(fieldErrors.reason)}
                aria-describedby={
                  fieldErrors.reason ? "return-reason-error" : undefined
                }
                disabled={pending}
              />
              <FieldDescription>
                Stored on every returned line and in the audit log. At least 3
                characters.
              </FieldDescription>
              <FieldError id="return-reason-error">
                {fieldErrors.reason}
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
              <Button
                type="submit"
                disabled={pending || returnableLines.length === 0}
                aria-busy={pending}
              >
                {pending ? "Recording return..." : "Record return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
