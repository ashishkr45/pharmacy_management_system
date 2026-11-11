"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FullPageLoading } from "@/components/shared/loading-state";
import { useAuth } from "@/lib/auth/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "anonymous") {
      return;
    }

    const next =
      pathname && pathname !== "/" ? pathname : "/dashboard";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return (
      <FullPageLoading
        label={
          status === "loading"
            ? "Checking your session..."
            : "Redirecting to sign in..."
        }
      />
    );
  }

  return <>{children}</>;
}
