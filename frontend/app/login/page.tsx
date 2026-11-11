"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CircleCheck,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Brand } from "@/components/layout/brand";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";

const DEMO_PASSWORD = "Demo@1234";

const DEMO_ACCOUNTS = [
  {
    role: "Administrator",
    email: "admin@pharmacy.test",
    detail: "Everything, including settings and audit logs",
  },
  {
    role: "Pharmacist",
    email: "pharmacist@pharmacy.test",
    detail: "Sales, invoices, returns and inventory view",
  },
  {
    role: "Inventory manager",
    email: "inventory@pharmacy.test",
    detail: "Catalogue, purchases, adjustments and stock reports",
  },
] as const;

const FEATURES = [
  "FEFO allocation across batches",
  "Expiry blocking before a sale is accepted",
  "An immutable stock-movement ledger",
  "Server-enforced role permissions",
] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }

    setError(null);
    setPending(true);

    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.name.split(/\s+/)[0] ?? user.name}`);

      const requested = new URLSearchParams(window.location.search).get("next");
      const target =
        requested && requested.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/dashboard";
      router.replace(target);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary-foreground/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-primary-foreground/10 blur-3xl"
          aria-hidden="true"
        />
        <Brand tone="inverted" className="relative" />

        <div className="relative max-w-md space-y-6">
          <div className="space-y-3">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary-foreground/70">
              Pharmacy operations, under control
            </p>
            <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">
              Every batch, every movement, every sale.
            </h1>
            <p className="text-sm leading-relaxed text-primary-foreground/80">
              A small, focused pharmacy system built around batch-level
              inventory, first-expiry-first-out selling and a ledger that never
              forgets.
            </p>
          </div>

          <ul className="space-y-2.5">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm text-primary-foreground/85"
              >
                <CircleCheck
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Demo environment · all medicines and accounts are fictional
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="space-y-1">
            <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary lg:hidden">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Sign in
            </h2>
            <p className="text-sm text-muted-foreground">
              Use a demo account or your own credentials to open the workspace.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive" id="login-error">
              <AlertTitle>Could not sign in</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-describedby={error ? "login-error" : undefined}
          >
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="you@pharmacy.test"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
                aria-invalid={Boolean(error) || undefined}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-invalid={Boolean(error) || undefined}
              />
            </Field>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Demo accounts</p>
              <code className="rounded bg-background px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">
                {DEMO_PASSWORD}
              </code>
            </div>
            <div className="mt-2 space-y-1">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(DEMO_PASSWORD);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition-colors outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">
                      {account.role}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-muted-foreground">
                      {account.email}
                    </span>
                    <span className="mt-0.5 block text-[0.625rem] text-muted-foreground">
                      {account.detail}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.625rem] text-muted-foreground">
              Selecting an account fills the form; no password is sent until you
              press Sign in.
            </p>
          </div>

          <p className="text-center text-[0.625rem] leading-relaxed text-muted-foreground">
            Protected by role-based access control. The API remains the
            authority on every request.
          </p>
        </div>
      </section>
    </div>
  );
}
