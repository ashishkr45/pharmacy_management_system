import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/api/types";
import { ROLE_LABELS } from "@/lib/roles";

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={className}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}
