"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { Category } from "@/lib/api/types";

export function CategoryCreateDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) {
      return;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      setName("");
      setFieldErrors({});
      setFormError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: "Name is required." });
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await apiRequest<Category>("/categories", {
        method: "POST",
        body: { name: trimmedName },
      });
      toast.success("Category created");
      setOpen(false);
      onCreated();
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The category could not be created.",
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
    <>
      <Button type="button" onClick={() => handleOpenChange(true)}>
        <Plus aria-hidden="true" />
        New category
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>
              Categories group medicines in the catalogue and filters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not create category</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Field data-invalid={Boolean(fieldErrors.name)}>
              <FieldLabel htmlFor="category-name">Name</FieldLabel>
              <Input
                id="category-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Analgesics"
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "category-name-error" : undefined
                }
                autoFocus
                required
              />
              <FieldError id="category-name-error">
                {fieldErrors.name}
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
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
