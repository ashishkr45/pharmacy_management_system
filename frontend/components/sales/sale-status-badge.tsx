import { Badge } from "@/components/ui/badge";
import type { SaleStatus } from "@/lib/api/types";
import { SALE_STATUS_LABELS } from "@/lib/sales";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<SaleStatus, string> = {
  COMPLETED:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  PARTIALLY_RETURNED:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  FULLY_RETURNED:
    "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function SaleStatusBadge({
  status,
  className,
}: {
  status: SaleStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(STATUS_CLASSES[status], className)}>
      {SALE_STATUS_LABELS[status]}
    </Badge>
  );
}
