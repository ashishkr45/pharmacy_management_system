"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";
import { invalidateApiCache } from "@/lib/api/cache";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { Medicine, Purchase, Supplier } from "@/lib/api/types";
import { todayDateInput } from "@/lib/date-input";
import { formatMoney } from "@/lib/format";

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d+$/;

interface LineDraft {
  key: string;
  medicineId: string;
  batchNo: string;
  quantity: string;
  costPrice: string;
  salePrice: string;
  expiryDate: string;
}

function createLine(key: string): LineDraft {
  return {
    key,
    medicineId: "",
    batchNo: "",
    quantity: "",
    costPrice: "",
    salePrice: "",
    expiryDate: "",
  };
}

function lineError(fieldErrors: FieldErrors, index: number, field: string) {
  return fieldErrors[`items.${index}.${field}`];
}

function estimatedLineTotal(line: LineDraft): number {
  const quantity = Number(line.quantity);
  const cost = Number(line.costPrice);
  return Number.isFinite(quantity) && Number.isFinite(cost) && quantity > 0 && cost >= 0
    ? quantity * cost
    : 0;
}

export function PurchaseForm({
  suppliers,
  medicines,
}: {
  suppliers: Supplier[];
  medicines: Medicine[];
}) {
  const router = useRouter();
  const lineCounter = useRef(2);
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([createLine("line-1")]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const supplierItems = useMemo(
    () =>
      suppliers.map((supplier) => ({
        label: supplier.name,
        value: String(supplier.id),
      })),
    [suppliers],
  );

  const medicineItems = useMemo(
    () =>
      medicines.map((medicine) => ({
        label: `${medicine.name} (${medicine.sku})`,
        value: String(medicine.id),
      })),
    [medicines],
  );

  const estimatedTotal = useMemo(
    () => lines.reduce((sum, line) => sum + estimatedLineTotal(line), 0),
    [lines],
  );

  const unavailable = suppliers.length === 0 || medicines.length === 0;

  const clearFieldError = (key: string) => {
    setFieldErrors((previous) => {
      if (!previous[key]) {
        return previous;
      }
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const updateLine = <K extends keyof LineDraft>(
    key: string,
    field: K,
    value: LineDraft[K],
  ) => {
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  };

  const addLine = () => {
    const key = `line-${lineCounter.current}`;
    lineCounter.current += 1;
    setLines((previous) => [...previous, createLine(key)]);
    setFieldErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([field]) => !field.startsWith("items.")),
      ),
    );
    setFormError(null);
  };

  const removeLine = (key: string) => {
    setLines((previous) =>
      previous.length <= 1
        ? previous
        : previous.filter((line) => line.key !== key),
    );
    setFieldErrors((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([field]) => !field.startsWith("items.")),
      ),
    );
    setFormError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const today = todayDateInput();

    if (!supplierId) {
      errors.supplierId = "Select a supplier.";
    }
    if (!supplierInvoiceNo.trim()) {
      errors.supplierInvoiceNo = "Invoice number is required.";
    } else if (supplierInvoiceNo.trim().length > 80) {
      errors.supplierInvoiceNo = "Invoice number must be at most 80 characters.";
    }

    const seen = new Set<string>();

    lines.forEach((line, index) => {
      if (!line.medicineId) {
        errors[`items.${index}.medicineId`] = "Select a medicine.";
      }
      if (!line.batchNo.trim()) {
        errors[`items.${index}.batchNo`] = "Batch number is required.";
      } else if (line.batchNo.trim().length > 50) {
        errors[`items.${index}.batchNo`] =
          "Batch number must be at most 50 characters.";
      }

      if (!QUANTITY_PATTERN.test(line.quantity.trim()) || Number(line.quantity) <= 0) {
        errors[`items.${index}.quantity`] =
          "Enter a positive whole quantity.";
      } else if (Number(line.quantity) > 1_000_000) {
        errors[`items.${index}.quantity`] = "Quantity must be at most 1,000,000.";
      }

      if (!MONEY_PATTERN.test(line.costPrice.trim())) {
        errors[`items.${index}.costPrice`] =
          "Use a non-negative amount with up to 2 decimals.";
      }
      if (!MONEY_PATTERN.test(line.salePrice.trim())) {
        errors[`items.${index}.salePrice`] =
          "Use a non-negative amount with up to 2 decimals.";
      }

      if (!line.expiryDate) {
        errors[`items.${index}.expiryDate`] = "Expiry date is required.";
      } else if (line.expiryDate <= today) {
        errors[`items.${index}.expiryDate`] =
          "Expiry date must be in the future.";
      }

      if (line.medicineId && line.batchNo.trim()) {
        const lineKey = `${line.medicineId}:${line.batchNo.trim().toUpperCase()}`;
        if (seen.has(lineKey)) {
          errors[`items.${index}.batchNo`] =
            "This medicine and batch already appears in the purchase.";
        }
        seen.add(lineKey);
      }
    });

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    const payload = {
      supplierId: Number(supplierId),
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      ...(purchaseDate ? { purchaseDate } : {}),
      items: lines.map((line) => ({
        medicineId: Number(line.medicineId),
        batchNo: line.batchNo.trim().toUpperCase(),
        quantity: Number(line.quantity),
        costPrice: line.costPrice.trim(),
        salePrice: line.salePrice.trim(),
        expiryDate: line.expiryDate,
      })),
    };

    try {
      const purchase = await apiRequest<Purchase>("/purchases", {
        method: "POST",
        body: payload,
      });
      invalidateApiCache([
        "/purchases",
        "/batches",
        "/alerts",
        "/stock-movements",
        "/dashboard",
        "/reports",
        "/audit-logs",
      ]);
      toast.success("Purchase received; stock and ledger updated");
      router.push(`/purchases/${purchase.id}`);
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The purchase could not be received.",
      );
      const visibleError = Object.keys(parsed.fields).some(
        (key) =>
          key === "supplierId" ||
          key === "supplierInvoiceNo" ||
          key === "purchaseDate" ||
          key.startsWith("items."),
      );
      setFieldErrors(parsed.fields);
      setFormError(visibleError ? null : parsed.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not receive purchase</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {unavailable ? (
        <Alert variant="destructive">
          <AlertTitle>Purchase form unavailable</AlertTitle>
          <AlertDescription>
            Receiving stock needs at least one active supplier and one active
            medicine. Create or reactivate them in the catalogue first.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <div>
          <h2 className="font-heading text-sm font-medium">Supplier invoice</h2>
          <p className="text-xs/relaxed text-muted-foreground">
            The purchase date defaults to today on the server when left blank.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.supplierId)}>
            <FieldLabel htmlFor="purchase-supplier">Supplier</FieldLabel>
            <Select
              items={supplierItems}
              value={supplierId}
              onValueChange={(value) => {
                setSupplierId(value ?? "");
                clearFieldError("supplierId");
              }}
              disabled={suppliers.length === 0}
            >
              <SelectTrigger
                id="purchase-supplier"
                className="w-full"
                aria-label="Supplier"
                aria-invalid={Boolean(fieldErrors.supplierId)}
                aria-describedby={
                  fieldErrors.supplierId ? "purchase-supplier-error" : undefined
                }
              >
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {supplierItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="purchase-supplier-error">
              {fieldErrors.supplierId}
            </FieldError>
          </Field>

          <Field data-invalid={Boolean(fieldErrors.supplierInvoiceNo)}>
            <FieldLabel htmlFor="purchase-invoice">
              Supplier invoice no.
            </FieldLabel>
            <Input
              id="purchase-invoice"
              value={supplierInvoiceNo}
              onChange={(event) => {
                setSupplierInvoiceNo(event.target.value);
                clearFieldError("supplierInvoiceNo");
              }}
              placeholder="e.g. INV-2026-001"
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.supplierInvoiceNo)}
              aria-describedby={
                fieldErrors.supplierInvoiceNo
                  ? "purchase-invoice-error"
                  : undefined
              }
              required
            />
            <FieldError id="purchase-invoice-error">
              {fieldErrors.supplierInvoiceNo}
            </FieldError>
          </Field>

          <Field data-invalid={Boolean(fieldErrors.purchaseDate)}>
            <FieldLabel htmlFor="purchase-date">Purchase date</FieldLabel>
            <Input
              id="purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(event) => {
                setPurchaseDate(event.target.value);
                clearFieldError("purchaseDate");
              }}
              aria-invalid={Boolean(fieldErrors.purchaseDate)}
              aria-describedby={
                fieldErrors.purchaseDate ? "purchase-date-error" : undefined
              }
            />
            <FieldError id="purchase-date-error">
              {fieldErrors.purchaseDate}
            </FieldError>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-sm font-medium">Items</h2>
            <p className="text-xs/relaxed text-muted-foreground">
              Every line creates or merges a batch and writes one PURCHASE
              movement in the same transaction.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus aria-hidden="true" />
            Add item
          </Button>
        </div>

        {fieldErrors.items ? (
          <p className="text-xs text-destructive">{fieldErrors.items}</p>
        ) : null}

        <div className="space-y-3">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <div
                key={line.key}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-xs font-medium">
                    Item {lineNumber}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1 || pending}
                    aria-label={`Remove item ${lineNumber}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Field
                    className="lg:col-span-3"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "medicineId"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-medicine`}>
                      Medicine
                    </FieldLabel>
                    <Select
                      items={medicineItems}
                      value={line.medicineId}
                      onValueChange={(value) => {
                        updateLine(line.key, "medicineId", value ?? "");
                        clearFieldError(`items.${index}.medicineId`);
                      }}
                      disabled={medicines.length === 0}
                    >
                      <SelectTrigger
                        id={`line-${line.key}-medicine`}
                        className="w-full"
                        aria-label={`Medicine for item ${lineNumber}`}
                        aria-invalid={Boolean(
                          lineError(fieldErrors, index, "medicineId"),
                        )}
                        aria-describedby={
                          lineError(fieldErrors, index, "medicineId")
                            ? `line-${line.key}-medicine-error`
                            : undefined
                        }
                      >
                        <SelectValue placeholder="Select a medicine" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicineItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError id={`line-${line.key}-medicine-error`}>
                      {lineError(fieldErrors, index, "medicineId")}
                    </FieldError>
                  </Field>

                  <Field
                    className="lg:col-span-2"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "batchNo"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-batch`}>
                      Batch no.
                    </FieldLabel>
                    <Input
                      id={`line-${line.key}-batch`}
                      value={line.batchNo}
                      onChange={(event) => {
                        updateLine(line.key, "batchNo", event.target.value);
                        clearFieldError(`items.${index}.batchNo`);
                      }}
                      placeholder="e.g. PCM-2601"
                      maxLength={50}
                      className="font-mono uppercase"
                      aria-invalid={Boolean(
                        lineError(fieldErrors, index, "batchNo"),
                      )}
                      aria-describedby={
                        lineError(fieldErrors, index, "batchNo")
                          ? `line-${line.key}-batch-error`
                          : undefined
                      }
                      required
                    />
                    <FieldError id={`line-${line.key}-batch-error`}>
                      {lineError(fieldErrors, index, "batchNo")}
                    </FieldError>
                  </Field>

                  <Field
                    className="lg:col-span-1"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "quantity"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-quantity`}>
                      Qty
                    </FieldLabel>
                    <Input
                      id={`line-${line.key}-quantity`}
                      type="number"
                      min={1}
                      max={1_000_000}
                      step={1}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(event) => {
                        updateLine(line.key, "quantity", event.target.value);
                        clearFieldError(`items.${index}.quantity`);
                      }}
                      aria-invalid={Boolean(
                        lineError(fieldErrors, index, "quantity"),
                      )}
                      aria-describedby={
                        lineError(fieldErrors, index, "quantity")
                          ? `line-${line.key}-quantity-error`
                          : undefined
                      }
                      required
                    />
                    <FieldError id={`line-${line.key}-quantity-error`}>
                      {lineError(fieldErrors, index, "quantity")}
                    </FieldError>
                  </Field>

                  <Field
                    className="lg:col-span-2"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "expiryDate"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-expiry`}>
                      Expiry date
                    </FieldLabel>
                    <Input
                      id={`line-${line.key}-expiry`}
                      type="date"
                      value={line.expiryDate}
                      onChange={(event) => {
                        updateLine(line.key, "expiryDate", event.target.value);
                        clearFieldError(`items.${index}.expiryDate`);
                      }}
                      aria-invalid={Boolean(
                        lineError(fieldErrors, index, "expiryDate"),
                      )}
                      aria-describedby={
                        lineError(fieldErrors, index, "expiryDate")
                          ? `line-${line.key}-expiry-error`
                          : undefined
                      }
                      required
                    />
                    <FieldError id={`line-${line.key}-expiry-error`}>
                      {lineError(fieldErrors, index, "expiryDate")}
                    </FieldError>
                  </Field>

                  <Field
                    className="lg:col-span-2"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "costPrice"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-cost`}>
                      Cost price
                    </FieldLabel>
                    <Input
                      id={`line-${line.key}-cost`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={line.costPrice}
                      onChange={(event) => {
                        updateLine(line.key, "costPrice", event.target.value);
                        clearFieldError(`items.${index}.costPrice`);
                      }}
                      placeholder="0.00"
                      aria-invalid={Boolean(
                        lineError(fieldErrors, index, "costPrice"),
                      )}
                      aria-describedby={
                        lineError(fieldErrors, index, "costPrice")
                          ? `line-${line.key}-cost-error`
                          : undefined
                      }
                      required
                    />
                    <FieldError id={`line-${line.key}-cost-error`}>
                      {lineError(fieldErrors, index, "costPrice")}
                    </FieldError>
                  </Field>

                  <Field
                    className="lg:col-span-2"
                    data-invalid={Boolean(
                      lineError(fieldErrors, index, "salePrice"),
                    )}
                  >
                    <FieldLabel htmlFor={`line-${line.key}-sale`}>
                      Sale price
                    </FieldLabel>
                    <Input
                      id={`line-${line.key}-sale`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={line.salePrice}
                      onChange={(event) => {
                        updateLine(line.key, "salePrice", event.target.value);
                        clearFieldError(`items.${index}.salePrice`);
                      }}
                      placeholder="0.00"
                      aria-invalid={Boolean(
                        lineError(fieldErrors, index, "salePrice"),
                      )}
                      aria-describedby={
                        lineError(fieldErrors, index, "salePrice")
                          ? `line-${line.key}-sale-error`
                          : undefined
                      }
                      required
                    />
                    <FieldError id={`line-${line.key}-sale-error`}>
                      {lineError(fieldErrors, index, "salePrice")}
                    </FieldError>
                  </Field>
                </div>

                <p className="text-right text-xs text-muted-foreground">
                  Estimated cost:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatMoney(estimatedLineTotal(line))}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Estimated total:{" "}
          <span className="font-heading text-sm font-medium tabular-nums text-foreground">
            {formatMoney(estimatedTotal)}
          </span>{" "}
          · the API recalculates the actual total
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/purchases" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <Button type="submit" disabled={pending || unavailable}>
            {pending ? "Receiving stock..." : "Receive stock"}
          </Button>
        </div>
      </div>
    </form>
  );
}
