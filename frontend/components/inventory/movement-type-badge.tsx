import { Badge } from "@/components/ui/badge";
import type { StockMovementType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<StockMovementType, string> = {
  OPENING: "text-muted-foreground",
  PURCHASE:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  SALE: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  RETURN:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ADJUSTMENT:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  return (
    <Badge variant="outline" className={cn("font-mono", TYPE_STYLES[type])}>
      {type}
    </Badge>
  );
}
