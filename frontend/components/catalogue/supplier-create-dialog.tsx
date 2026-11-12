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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api/client";
import { readApiFormError, type FieldErrors } from "@/lib/api/form-errors";
import type { Supplier } from "@/lib/api/types";

const STATUS_ITEMS = [
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function SupplierCreateDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resetForm = () => {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setIsActive(true);
    setFieldErrors({});
    setFormError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pending) {
      return;
    }

    setOpen(nextOpen);
    if (nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setFieldErrors({ name: "Name is required." });
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await apiRequest<Supplier>("/suppliers", {
        method: "POST",
        body: {
          name: name.trim(),
          contactPerson: nullable(contactPerson),
          phone: nullable(phone),
          email: nullable(email),
          address: nullable(address),
          isActive,
        },
      });
      toast.success("Supplier created");
      setOpen(false);
      onCreated();
    } catch (error: unknown) {
      const parsed = readApiFormError(
        error,
        "The supplier could not be created.",
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
        New supplier
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>
              Suppliers are used when recording purchase orders and batch
              costs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not create supplier</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                data-invalid={Boolean(fieldErrors.name)}
                className="sm:col-span-2"
              >
                <FieldLabel htmlFor="supplier-name">Name</FieldLabel>
                <Input
                  id="supplier-name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. BlueLeaf Healthcare Supplies"
                  maxLength={150}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={
                    fieldErrors.name ? "supplier-name-error" : undefined
                  }
                  autoFocus
                  required
                />
                <FieldError id="supplier-name-error">
                  {fieldErrors.name}
                </FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-contact">
                  Contact person
                </FieldLabel>
                <Input
                  id="supplier-contact"
                  name="contactPerson"
                  value={contactPerson}
                  onChange={(event) => setContactPerson(event.target.value)}
                  placeholder="Optional"
                  maxLength={120}
                  aria-invalid={Boolean(fieldErrors.contactPerson)}
                  aria-describedby={
                    fieldErrors.contactPerson
                      ? "supplier-contact-error"
                      : undefined
                  }
                />
                <FieldError id="supplier-contact-error">
                  {fieldErrors.contactPerson}
                </FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-phone">Phone</FieldLabel>
                <Input
                  id="supplier-phone"
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+91 00000 00000"
                  maxLength={30}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={
                    fieldErrors.phone ? "supplier-phone-error" : undefined
                  }
                />
                <FieldError id="supplier-phone-error">
                  {fieldErrors.phone}
                </FieldError>
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="supplier-email">Email</FieldLabel>
                <Input
                  id="supplier-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="orders@supplier.example"
                  maxLength={150}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "supplier-email-error" : undefined
                  }
                />
                <FieldError id="supplier-email-error">
                  {fieldErrors.email}
                </FieldError>
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="supplier-address">Address</FieldLabel>
                <Textarea
                  id="supplier-address"
                  name="address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Optional"
                  maxLength={300}
                  aria-invalid={Boolean(fieldErrors.address)}
                  aria-describedby={
                    fieldErrors.address ? "supplier-address-error" : undefined
                  }
                />
                <FieldError id="supplier-address-error">
                  {fieldErrors.address}
                </FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="supplier-status">Status</FieldLabel>
                <Select
                  name="isActive"
                  items={STATUS_ITEMS}
                  value={isActive ? "true" : "false"}
                  onValueChange={(value) => setIsActive(value === "true")}
                >
                  <SelectTrigger
                    id="supplier-status"
                    className="w-full"
                    aria-label="Supplier status"
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
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
