"use client";

import type { ReactNode } from "react";
import type { Role } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";
import { AccessDenied } from "@/components/auth/access-denied";
import { LoadingState } from "@/components/shared/loading-state";

export function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return <LoadingState label="Checking your permissions..." className="py-24" />;
  }

  // RequireAuth owns the redirect when there is no session.
  if (!user) {
    return null;
  }

  if (!roles.includes(user.role)) {
    return <AccessDenied role={user.role} />;
  }

  return <>{children}</>;
}
