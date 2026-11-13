import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One compact metric card used by the dashboard and report screens. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : tone === "warning"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : tone === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
