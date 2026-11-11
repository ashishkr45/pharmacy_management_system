import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppShell } from "@/components/layout/app-shell";

// The protected shell intentionally waits for the client-side session check
// before rendering, so this subtree is allowed to block during navigation.
export const instant = false;

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
