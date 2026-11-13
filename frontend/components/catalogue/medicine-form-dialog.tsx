"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { apiRequest } from "@/lib/api/client";
import { invalidateApiCache } from "@/lib/api/cache";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { Category, Medicine } from "@/lib/api/types";

const STATUS_ITEMS = [
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

interface MedicineFormState {
  name: string;
  genericName: string;
  sku: string;
  categoryId: string;
  unit: string;
  reorderLevel: string;
  taxRate: string;
  defaultSalePrice: string;
  isActive: boolean;
}

function initialState(medicine: Medicine | null): MedicineFormState {
  return {
    name: medicine?.name ?? "",
    genericName: medicine?.genericName ?? "",
    sku: medicine?.sku ?? "",
    categoryId: medicine ? String(medicine.categoryId) : "",
    unit: medicine?.unit ?? "",
    reorderLevel: medicine ? String(medicine.reorderLevel) : "0",
    taxRate: medicine?.taxRate ?? "",
    defaultSalePrice: medicine?.defaultSalePrice ?? "",
    isActive: medicine?.isActive ?? true,
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validate(form: MedicineFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!form.sku.trim()) {
    errors.sku = "SKU is required.";
  } else if (!SKU_PATTERN.test(form.sku.trim())) {
    errors.sku = "Use letters, digits and hyphens only.";
  }

  if (!form.categoryId) {
    errors.categoryId = "Select a category.";
  }

  if (!form.unit.trim()) {
    errors.unit = "Unit is required.";
  }

  if (
    form.reorderLevel.trim() !== "" &&
    (!/^\d+$/.test(form.reorderLevel.trim()) ||
      Number(form.reorderLevel) > 1_000_000)
  ) {
    errors.reorderLevel = "Use a whole number between 0 and 1,000,000.";
  }

  if (form.taxRate.trim() !== "") {
    if (!MONEY_PATTERN.test(form.taxRate.trim())) {
      errors.taxRate = "Use a number with up to 2 decimals.";
    } else if (Number(form.taxRate) > 100) {
      errors.taxRate = "Tax rate must be between 0 and 100.";
    }
  }

  if (
    form.defaultSalePrice.trim() !== "" &&
    !MONEY_PATTERN.test(form.defaultSalePrice.trim())
  ) {
    errors.defaultSalePrice = "Use a non-negative amount with up to 2 decimals.";
  }

  return errors;
}

export function MedicineFormDialog({
  open,
  onOpenChange,
  medicine,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine: Medicine | null;
  categories: Category[];
}) {
  const [form, setForm] = useState<MedicineFormState>(() =>
    initialState(medicine),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update = <K extends keyof MedicineFormState>(
    field: K,
    value: MedicineFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    const payload = {
      name: form.name.trim(),
      genericName: nullable(form.genericName),
      sku: form.sku.trim().toUpperCase(),
      categoryId: Number(form.categoryId),
      unit: form.unit.trim(),
      reorderLevel:
        form.reorderLevel.trim() === "" ? 0 : Number(form.reorderLevel),
      taxRate: nullable(form.taxRate),
      defaultSalePrice: nullable(form.defaultSalePrice),
      isActive: form.isActive,
    };

    try {
      await apiRequest<Medicine>(
        medicine ? `/medicines/${medicine.id}` : "/medicines",
        {
          method: medicine ? "PATCH" : "POST",
          body: payload,
        },
      );
      // Medicine metadata appears in the catalogue, inventory, alerts,
      // purchases and reports, so clear the wider read set.
      invalidateApiCache([
        "/categories",
        "/medicines",
        "/batches",
        "/alerts",
        "/stock-movements",
        "/purchases",
        "/sales",
        "/dashboard",
        "/reports",
        "/audit-logs",
      ]);
      toast.success(medicine ? "Medicine updated" : "Medicine created");
      onOpenChange(false);
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        medicine
          ? "The medicine could not be updated."
          : "The medicine could not be created.",
      );
      setFieldErrors(parsed.fields);
      setFormError(
        Object.keys(parsed.fields).length > 0 ? null : parsed.message,
      );
    } finally {
      setPending(false);
    }
  };

  const categoryItems = categories.map((category) => ({
    label: category.name,
    value: String(category.id),
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{medicine ? "Edit medicine" : "New medicine"}</DialogTitle>
          <DialogDescription>
            {medicine
              ? "Update catalogue details, prices, tax or active status."
              : "Add a medicine to the catalogue. Batches and stock are added later through purchases."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <Alert variant="destructive">
              <AlertTitle>
                {medicine ? "Could not update medicine" : "Could not create medicine"}
              </AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(fieldErrors.name)}>
              <FieldLabel htmlFor="medicine-name">Name</FieldLabel>
              <Input
                id="medicine-name"
                name="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                maxLength={150}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "medicine-name-error" : undefined
                }
                autoFocus
                required
              />
              <FieldError id="medicine-name-error">
                {fieldErrors.name}
              </FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="medicine-generic">Generic name</FieldLabel>
              <Input
                id="medicine-generic"
                name="genericName"
                value={form.genericName}
                onChange={(event) => update("genericName", event.target.value)}
                placeholder="Optional"
                maxLength={150}
                aria-invalid={Boolean(fieldErrors.genericName)}
                aria-describedby={
                  fieldErrors.genericName
                    ? "medicine-generic-error"
                    : undefined
                }
              />
              <FieldError id="medicine-generic-error">
                {fieldErrors.genericName}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.sku)}>
              <FieldLabel htmlFor="medicine-sku">SKU</FieldLabel>
              <Input
                id="medicine-sku"
                name="sku"
                value={form.sku}
                onChange={(event) => update("sku", event.target.value)}
                placeholder="e.g. MED-001"
                maxLength={50}
                className="font-mono uppercase"
                aria-invalid={Boolean(fieldErrors.sku)}
                aria-describedby={
                  fieldErrors.sku ? "medicine-sku-error" : undefined
                }
                required
              />
              <FieldError id="medicine-sku-error">{fieldErrors.sku}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.categoryId)}>
              <FieldLabel htmlFor="medicine-category">Category</FieldLabel>
              <Select
                name="categoryId"
                items={categoryItems}
                value={form.categoryId}
                onValueChange={(value) => update("categoryId", value ?? "")}
                disabled={categories.length === 0}
              >
                <SelectTrigger
                  id="medicine-category"
                  className="w-full"
                  aria-label="Medicine category"
                  aria-invalid={Boolean(fieldErrors.categoryId)}
                  aria-describedby={
                    fieldErrors.categoryId
                      ? "medicine-category-error"
                      : undefined
                  }
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 ? (
                <FieldDescription>
                  No categories are available. Create a category first.
                </FieldDescription>
              ) : null}
              <FieldError id="medicine-category-error">
                {fieldErrors.categoryId}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.unit)}>
              <FieldLabel htmlFor="medicine-unit">Unit</FieldLabel>
              <Input
                id="medicine-unit"
                name="unit"
                value={form.unit}
                onChange={(event) => update("unit", event.target.value)}
                placeholder="e.g. strip, bottle, tube"
                maxLength={30}
                aria-invalid={Boolean(fieldErrors.unit)}
                aria-describedby={
                  fieldErrors.unit ? "medicine-unit-error" : undefined
                }
                required
              />
              <FieldError id="medicine-unit-error">{fieldErrors.unit}</FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.reorderLevel)}>
              <FieldLabel htmlFor="medicine-reorder">Reorder level</FieldLabel>
              <Input
                id="medicine-reorder"
                name="reorderLevel"
                type="number"
                min={0}
                max={1_000_000}
                step={1}
                inputMode="numeric"
                value={form.reorderLevel}
                onChange={(event) => update("reorderLevel", event.target.value)}
                aria-invalid={Boolean(fieldErrors.reorderLevel)}
                aria-describedby={
                  fieldErrors.reorderLevel
                    ? "medicine-reorder-error"
                    : undefined
                }
              />
              <FieldError id="medicine-reorder-error">
                {fieldErrors.reorderLevel}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.taxRate)}>
              <FieldLabel htmlFor="medicine-tax">Tax rate (%)</FieldLabel>
              <Input
                id="medicine-tax"
                name="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                value={form.taxRate}
                onChange={(event) => update("taxRate", event.target.value)}
                placeholder="Use settings default"
                aria-invalid={Boolean(fieldErrors.taxRate)}
                aria-describedby={
                  fieldErrors.taxRate ? "medicine-tax-error" : undefined
                }
              />
              <FieldError id="medicine-tax-error">
                {fieldErrors.taxRate}
              </FieldError>
            </Field>

            <Field data-invalid={Boolean(fieldErrors.defaultSalePrice)}>
              <FieldLabel htmlFor="medicine-price">
                Default sale price
              </FieldLabel>
              <Input
                id="medicine-price"
                name="defaultSalePrice"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.defaultSalePrice}
                onChange={(event) =>
                  update("defaultSalePrice", event.target.value)
                }
                placeholder="Optional"
                aria-invalid={Boolean(fieldErrors.defaultSalePrice)}
                aria-describedby={
                  fieldErrors.defaultSalePrice
                    ? "medicine-price-error"
                    : undefined
                }
              />
              <FieldError id="medicine-price-error">
                {fieldErrors.defaultSalePrice}
              </FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="medicine-status">Status</FieldLabel>
              <Select
                name="isActive"
                items={STATUS_ITEMS}
                value={form.isActive ? "true" : "false"}
                onValueChange={(value) =>
                  update("isActive", value === "true")
                }
              >
                <SelectTrigger
                  id="medicine-status"
                  className="w-full"
                  aria-label="Medicine status"
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
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || categories.length === 0}>
              {pending
                ? medicine
                  ? "Saving..."
                  : "Creating..."
                : medicine
                  ? "Save changes"
                  : "Create medicine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
