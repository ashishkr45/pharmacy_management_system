"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Percent, RotateCcw, Save, Timer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { apiRequest } from "@/lib/api/client";
import { invalidateApiCache } from "@/lib/api/cache";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { PharmacySettings } from "@/lib/api/types";
import { useApiItem } from "@/lib/hooks/use-api-item";

interface SettingsFormState {
  defaultTaxRate: string;
  nearExpiryDays: string;
}

function toFormState(settings: PharmacySettings): SettingsFormState {
  return {
    defaultTaxRate: settings.defaultTaxRate,
    nearExpiryDays: String(settings.nearExpiryDays),
  };
}

function validate(form: SettingsFormState): FieldErrors {
  const errors: FieldErrors = {};
  const taxRate = form.defaultTaxRate.trim();
  const nearExpiryDays = form.nearExpiryDays.trim();

  if (
    !/^\d{1,3}(\.\d{1,2})?$/.test(taxRate) ||
    Number(taxRate) > 100
  ) {
    errors.defaultTaxRate = "Use a percentage between 0 and 100 with up to 2 decimals.";
  }

  if (
    !/^\d+$/.test(nearExpiryDays) ||
    Number(nearExpiryDays) < 1 ||
    Number(nearExpiryDays) > 3650
  ) {
    errors.nearExpiryDays = "Use a whole number between 1 and 3,650.";
  }

  return errors;
}

function SettingsForm({ initial }: { initial: PharmacySettings }) {
  const [form, setForm] = useState<SettingsFormState>(() => toFormState(initial));
  const [baseline, setBaseline] = useState<SettingsFormState>(() =>
    toFormState(initial),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isDirty =
    form.defaultTaxRate !== baseline.defaultTaxRate ||
    form.nearExpiryDays !== baseline.nearExpiryDays;

  const update = <K extends keyof SettingsFormState>(
    field: K,
    value: SettingsFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setFormError(null);
  };

  const reset = () => {
    setForm(baseline);
    setFieldErrors({});
    setFormError(null);
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

    try {
      const saved = await apiRequest<PharmacySettings>("/settings", {
        method: "PUT",
        body: {
          defaultTaxRate: form.defaultTaxRate.trim(),
          nearExpiryDays: Number(form.nearExpiryDays),
        },
      });

      const next = toFormState(saved);
      setForm(next);
      setBaseline(next);
      invalidateApiCache([
        "/settings",
        "/dashboard",
        "/alerts",
        "/batches",
        "/reports",
        "/audit-logs",
      ]);
      toast.success("Settings updated", {
        description: "New sales and expiry views now use the saved defaults.",
      });
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The settings could not be saved.",
      );
      setFieldErrors(parsed.fields);
      setFormError(
        Object.keys(parsed.fields).length > 0 ? null : parsed.message,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            These values are stored in the settings table and audited whenever
            they change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not save settings</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(fieldErrors.defaultTaxRate)}>
              <FieldLabel htmlFor="default-tax-rate">
                Default tax rate (%)
              </FieldLabel>
              <Input
                id="default-tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.defaultTaxRate}
                onChange={(event) =>
                  update("defaultTaxRate", event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.defaultTaxRate)}
                aria-describedby={
                  fieldErrors.defaultTaxRate
                    ? "default-tax-rate-error"
                    : "default-tax-rate-description"
                }
              />
              <FieldDescription id="default-tax-rate-description">
                Used when a medicine does not have its own tax rate. Existing
                sale lines keep the tax stored at the time of sale.
              </FieldDescription>
              {fieldErrors.defaultTaxRate ? (
                <FieldError id="default-tax-rate-error">
                  {fieldErrors.defaultTaxRate}
                </FieldError>
              ) : null}
            </Field>

            <Field data-invalid={Boolean(fieldErrors.nearExpiryDays)}>
              <FieldLabel htmlFor="near-expiry-days">
                Near-expiry window (days)
              </FieldLabel>
              <Input
                id="near-expiry-days"
                type="number"
                min={1}
                max={3650}
                step="1"
                value={form.nearExpiryDays}
                onChange={(event) =>
                  update("nearExpiryDays", event.target.value)
                }
                aria-invalid={Boolean(fieldErrors.nearExpiryDays)}
                aria-describedby={
                  fieldErrors.nearExpiryDays
                    ? "near-expiry-days-error"
                    : "near-expiry-days-description"
                }
              />
              <FieldDescription id="near-expiry-days-description">
                Batches expiring within this many days are near expiry in alerts,
                inventory and the default expiry report.
              </FieldDescription>
              {fieldErrors.nearExpiryDays ? (
                <FieldError id="near-expiry-days-error">
                  {fieldErrors.nearExpiryDays}
                </FieldError>
              ) : null}
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={pending || !isDirty}>
                {pending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                {pending ? "Saving..." : "Save settings"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={pending || !isDirty}
              >
                <RotateCcw aria-hidden="true" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>How these settings are used</CardTitle>
          <CardDescription>
            The API remains the source of truth for tax, stock and expiry rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs/relaxed text-muted-foreground">
          <div className="flex gap-2">
            <Percent className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              The default tax rate is applied to new sale lines only when the
              medicine has no rate of its own. Tax is still calculated and
              rounded by the server.
            </p>
          </div>
          <div className="flex gap-2">
            <Timer className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              The near-expiry window drives the alert count, the inventory
              near-expiry tab and the expiry report when no override is entered.
            </p>
          </div>
          <div className="flex gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p>
              A batch that expires today is already expired and cannot be sold,
              regardless of this window.
            </p>
          </div>
          <p>
            Every saved value is recorded in the{" "}
            <Link href="/audit-logs" className="font-medium text-primary underline-offset-4 hover:underline">
              audit log
            </Link>{" "}
            with its before and after value.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsView() {
  const settings = useApiItem<PharmacySettings>("/settings");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Admin-only defaults used by new sales and stock alerts."
      />

      {settings.isLoading ? (
        <Card>
          <LoadingState label="Loading settings..." />
        </Card>
      ) : settings.error ? (
        <Card>
          <ErrorState
            title="Settings unavailable"
            message={settings.error}
            onRetry={settings.reload}
          />
        </Card>
      ) : settings.data ? (
        <SettingsForm initial={settings.data} />
      ) : null}
    </div>
  );
}
