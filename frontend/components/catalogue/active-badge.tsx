import { Badge } from "@/components/ui/badge";

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "text-muted-foreground"
      }
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}
