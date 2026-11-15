"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invalidateApiCache } from "@/lib/api/cache";
import { apiRequest, buildQuery } from "@/lib/api/client";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import {
  PAYMENT_METHODS,
  type Medicine,
  type PaymentMethod,
  type Sale,
} from "@/lib/api/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useApiList } from "@/lib/hooks/use-api-list";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";

const PHONE_PATTERN = /^[0-9+()\- ]{5,20}$/;
const QUANTITY_PATTERN = /^\d+$/;
// The API caps pageSize at 100. Load the whole active catalogue so the
// cashier can browse every sellable medicine (and search for the rest).
const MEDICINE_RESULTS_PAGE_SIZE = 100;

interface CartLine {
  key: string;
  medicineId: number;
  name: string;
  sku: string;
  unit: string;
  quantity: string;
}

const PAYMENT_ITEMS = PAYMENT_METHODS.map((method) => ({
  label: PAYMENT_METHOD_LABELS[method],
  value: method,
}));

function createCartLine(key: string, medicine: Medicine): CartLine {
  return {
    key,
    medicineId: medicine.id,
    name: medicine.name,
    sku: medicine.sku,
    unit: medicine.unit,
    quantity: "1",
  };
}

function clearItemErrors(
  fieldErrors: FieldErrors,
): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      ([field]) => field !== "items" && !field.startsWith("items."),
    ),
  );
}

export function SaleForm() {
  const router = useRouter();
  const lineCounter = useRef(2);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isDirty =
    lines.length > 0 ||
    customerName.trim() !== "" ||
    customerPhone.trim() !== "" ||
    paymentMethod !== "CASH";

  const search = useDebouncedValue(searchInput.trim(), 300);
  const searchPath = `/medicines${buildQuery({
    isActive: "true",
    pageSize: MEDICINE_RESULTS_PAGE_SIZE,
    search: search || undefined,
  })}`;
  const medicineResults = useApiList<Medicine>(searchPath);
  const medicines = useMemo(
    () => medicineResults.data?.data ?? [],
    [medicineResults.data],
  );
  const addedMedicineIds = useMemo(
    () => new Set(lines.map((line) => line.medicineId)),
    [lines],
  );

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

  const addMedicine = (medicine: Medicine) => {
    if (addedMedicineIds.has(medicine.id) || pending) {
      return;
    }
    if (lines.length >= 50) {
      setFormError("At most 50 lines are allowed per sale.");
      return;
    }

    const key = `sale-line-${lineCounter.current}`;
    lineCounter.current += 1;
    setLines((previous) => [...previous, createCartLine(key, medicine)]);
    setFieldErrors((previous) => clearItemErrors(previous));
    setFormError(null);
    setSearchInput("");
    // Keep the cashier's scroll position; normal focus() scrolls the search
    // box back into view after each add.
    searchInputRef.current?.focus({ preventScroll: true });
  };

  const removeLine = (key: string) => {
    setLines((previous) => previous.filter((line) => line.key !== key));
    setFieldErrors((previous) => clearItemErrors(previous));
    setFormError(null);
  };

  const updateQuantity = (key: string, quantity: string) => {
    setLines((previous) =>
      previous.map((line) =>
        line.key === key ? { ...line, quantity } : line,
      ),
    );
    setFieldErrors((previous) => clearItemErrors(previous));
    setFormError(null);
  };

  const resetForm = () => {
    setSearchInput("");
    setLines([]);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("CASH");
    setFieldErrors({});
    setFormError(null);
    idempotencyKeyRef.current = null;
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const name = customerName.trim();
    const phone = customerPhone.trim();

    if (lines.length === 0) {
      errors.items = "Add at least one medicine to the sale.";
    }

    lines.forEach((line, index) => {
      if (
        !QUANTITY_PATTERN.test(line.quantity.trim()) ||
        Number(line.quantity) <= 0
      ) {
        errors[`items.${index}.quantity`] =
          "Enter a positive whole quantity.";
      } else if (Number(line.quantity) > 1_000_000) {
        errors[`items.${index}.quantity`] =
          "Quantity must be at most 1,000,000.";
      }
    });

    if (name.length > 120) {
      errors.customerName = "Customer name must be at most 120 characters.";
    }
    if (phone && !PHONE_PATTERN.test(phone)) {
      errors.customerPhone =
        "Use 5–20 digits, spaces, +, - or parentheses.";
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setFieldErrors({});
    setFormError(null);

    const idempotencyKey =
      idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;

    const payload = {
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      paymentMethod,
      items: lines.map((line) => ({
        medicineId: line.medicineId,
        quantity: Number(line.quantity),
      })),
    };

    try {
      const sale = await apiRequest<Sale>("/sales", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: payload,
      });

      invalidateApiCache([
        "/sales",
        "/batches",
        "/alerts",
        "/stock-movements",
        "/dashboard",
        "/reports",
        "/audit-logs",
      ]);
      resetForm();
      toast.success(`Sale ${sale.invoiceNo} completed`);
      // Replace the completed basket in history so Back cannot restore it.
      router.replace(`/sales/${sale.id}`);
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The sale could not be completed.",
      );
      const visibleError = Object.keys(parsed.fields).some(
        (key) =>
          key === "customerName" ||
          key === "customerPhone" ||
          key === "paymentMethod" ||
          key === "items" ||
          key.startsWith("items."),
      );
      setFieldErrors(parsed.fields);
      setFormError(visibleError ? null : parsed.message);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const resultLabel = search
    ? "Search results"
    : "Suggested active medicines";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
      aria-busy={pending}
    >
      <div className="min-w-0 space-y-6">
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-heading text-sm font-medium">
              Find a medicine
            </h2>
            <p className="text-xs/relaxed text-muted-foreground">
              Search the active catalogue by name, generic name or SKU. The
              server chooses the batches and prices after you submit.
            </p>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              id="sale-medicine-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search medicines..."
              aria-label="Search medicines to add to the sale"
              className="pl-8"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              {resultLabel}
            </p>
            {medicineResults.data ? (
              <p
                className="text-[0.6875rem] text-muted-foreground"
                aria-live="polite"
              >
                {medicineResults.data.meta.total > medicines.length
                  ? `Showing ${medicines.length} of ${medicineResults.data.meta.total} matches — search to narrow the list`
                  : `${medicineResults.data.meta.total} match${
                      medicineResults.data.meta.total === 1 ? "" : "es"
                    }`}
              </p>
            ) : null}
          </div>

          {medicineResults.error ? (
            <Alert variant="destructive">
              <AlertTitle>Medicine search failed</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{medicineResults.error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={medicineResults.reload}
                >
                  Retry search
                </Button>
              </AlertDescription>
            </Alert>
          ) : medicineResults.isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : medicines.length === 0 ? (
            <EmptyState
              title={search ? "No matching medicines" : "No active medicines"}
              description={
                search
                  ? "Try a different name, generic name or SKU."
                  : "An inventory manager must add or reactivate a medicine before it can be sold."
              }
              className="rounded-md border border-dashed py-8"
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {medicines.map((medicine) => {
                const added = addedMedicineIds.has(medicine.id);
                return (
                  <li key={medicine.id}>
                    <div className="flex h-full items-start justify-between gap-3 rounded-md border bg-background p-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-xs font-medium">
                          {medicine.name}
                        </p>
                        <p className="font-mono text-[0.625rem] text-muted-foreground">
                          {medicine.sku} · {medicine.unit}
                        </p>
                        <p className="text-[0.6875rem] text-muted-foreground">
                          {medicine.category.name}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={added ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => addMedicine(medicine)}
                        disabled={added || pending}
                        className="hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        aria-label={
                          added
                            ? `${medicine.name} is already in the sale`
                            : `Add ${medicine.name} to the sale`
                        }
                      >
                        {added ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <Plus aria-hidden="true" />
                        )}
                        {added ? "Added" : "Add"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-sm font-medium">Sale lines</h2>
              <p className="text-xs/relaxed text-muted-foreground">
                One line per medicine. FEFO may split a line across several
                batches in the completed sale.
              </p>
            </div>
            {lines.length > 0 ? (
              <Badge variant="outline">
                {lines.length} line{lines.length === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>

          {fieldErrors.items ? (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.items}
            </p>
          ) : null}

          {lines.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="The sale is empty"
              description="Search for a medicine above and add at least one line."
              className="rounded-lg border border-dashed bg-card"
            />
          ) : (
            <div className="space-y-2">
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                const quantityError =
                  fieldErrors[`items.${index}.quantity`];

                return (
                  <div
                    key={line.key}
                    className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end"
                  >
                    <div className="min-w-0">
                      <p className="text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        Line {lineNumber}
                      </p>
                      <p className="truncate text-xs font-medium">
                        {line.name}
                      </p>
                      <p className="font-mono text-[0.625rem] text-muted-foreground">
                        {line.sku} · {line.unit}
                      </p>
                    </div>

                    <Field data-invalid={Boolean(quantityError)}>
                      <FieldLabel htmlFor={`sale-line-${line.key}-quantity`}>
                        Quantity
                      </FieldLabel>
                      <Input
                        id={`sale-line-${line.key}-quantity`}
                        type="number"
                        min={1}
                        max={1_000_000}
                        step={1}
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) =>
                          updateQuantity(line.key, event.target.value)
                        }
                        aria-invalid={Boolean(quantityError)}
                        aria-describedby={
                          quantityError
                            ? `sale-line-${line.key}-quantity-error`
                            : undefined
                        }
                        disabled={pending}
                        required
                      />
                      <FieldError id={`sale-line-${line.key}-quantity-error`}>
                        {quantityError}
                      </FieldError>
                    </Field>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeLine(line.key)}
                      disabled={pending}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                      aria-label={`Remove ${line.name} from the sale`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>Sale could not be completed</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <aside className="h-fit space-y-5 rounded-lg border bg-card p-4 lg:sticky lg:top-20">
        <div>
          <h2 className="font-heading text-sm font-medium">Customer</h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Optional; if provided, the name appears on the invoice. Use
            fictional data in the demo.
          </p>
        </div>

        <Field data-invalid={Boolean(fieldErrors.customerName)}>
          <FieldLabel htmlFor="sale-customer-name">Name</FieldLabel>
          <Input
            id="sale-customer-name"
            value={customerName}
            onChange={(event) => {
              setCustomerName(event.target.value);
              clearFieldError("customerName");
            }}
            maxLength={120}
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.customerName)}
            aria-describedby={
              fieldErrors.customerName
                ? "sale-customer-name-error"
                : undefined
            }
          />
          <FieldError id="sale-customer-name-error">
            {fieldErrors.customerName}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(fieldErrors.customerPhone)}>
          <FieldLabel htmlFor="sale-customer-phone">Phone</FieldLabel>
          <Input
            id="sale-customer-phone"
            type="tel"
            value={customerPhone}
            onChange={(event) => {
              setCustomerPhone(event.target.value);
              clearFieldError("customerPhone");
            }}
            maxLength={20}
            autoComplete="off"
            placeholder="Optional"
            aria-invalid={Boolean(fieldErrors.customerPhone)}
            aria-describedby={
              fieldErrors.customerPhone
                ? "sale-customer-phone-error"
                : undefined
            }
          />
          <FieldError id="sale-customer-phone-error">
            {fieldErrors.customerPhone}
          </FieldError>
        </Field>

        <Field data-invalid={Boolean(fieldErrors.paymentMethod)}>
          <FieldLabel htmlFor="sale-payment-method">
            Payment method
          </FieldLabel>
          <Select
            items={PAYMENT_ITEMS}
            value={paymentMethod}
            onValueChange={(value) => {
              setPaymentMethod((value as PaymentMethod) ?? "CASH");
              clearFieldError("paymentMethod");
            }}
            disabled={pending}
          >
            <SelectTrigger
              id="sale-payment-method"
              className="w-full"
              aria-label="Payment method"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Label only; no payment is processed.
          </FieldDescription>
          <FieldError>{fieldErrors.paymentMethod}</FieldError>
        </Field>

        <div className="space-y-2 rounded-md bg-muted/50 p-3">
          <p className="text-xs font-medium">What happens on submit</p>
          <ul className="list-disc space-y-1 pl-4 text-[0.6875rem]/relaxed text-muted-foreground">
            <li>Expired and short batches are rejected by the server.</li>
            <li>FEFO can split one line across several batches.</li>
            <li>Prices, tax, totals and the invoice number are server-computed.</li>
          </ul>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Button
            type="submit"
            className="w-full hover:shadow-md hover:brightness-110"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? "Completing sale..." : "Complete sale"}
          </Button>
          <Link
            href="/sales"
            onClick={(event) => {
              if (
                isDirty &&
                !window.confirm(
                  "Discard this sale? The cart and customer details will be lost.",
                )
              ) {
                event.preventDefault();
              }
            }}
            className={buttonVariants({
              variant: "outline",
              className:
                "w-full hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
            })}
          >
            Cancel
          </Link>
          <p className="text-center text-[0.625rem] text-muted-foreground">
            Double submission is blocked, and the request carries an
            Idempotency-Key.
          </p>
        </div>
      </aside>
    </form>
  );
}
