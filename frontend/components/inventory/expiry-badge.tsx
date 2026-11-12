import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ExpiryBadge({
  expiryDate,
  daysUntilExpiry,
  expired,
}: {
  expiryDate: string;
  daysUntilExpiry: number;
  expired: boolean;
}) {
  const warning = !expired && daysUntilExpiry <= 60;
  const label = expired
    ? daysUntilExpiry === 0
      ? "Expired today"
      : `Expired ${Math.abs(daysUntilExpiry)}d ago`
    : `${daysUntilExpiry}d left`;

  return (
    <Badge
      variant="outline"
      title={`Expiry date: ${expiryDate}`}
      className={cn(
        expired &&
          "border-destructive/30 bg-destructive/10 text-destructive dark:bg-destructive/20",
        warning &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        !expired && !warning && "text-muted-foreground",
      )}
    >
      {label}
    </Badge>
  );
}
