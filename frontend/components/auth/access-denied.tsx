import Link from "next/link";
import { ShieldX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Role } from "@/lib/api/types";
import { ROLE_LABELS } from "@/lib/roles";

export function AccessDenied({ role }: { role: Role }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <ShieldX className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          Access denied
        </h2>
        <p className="text-sm text-muted-foreground">
          The {ROLE_LABELS[role]} role does not have permission to open this
          screen. Permission is enforced by the API as well as this page.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
