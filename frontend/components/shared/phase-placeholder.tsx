import { Construction, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PhasePlaceholder({
  phase,
  title,
  description,
  icon: Icon = Construction,
}: {
  phase: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <Badge variant="outline">{phase}</Badge>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        This route is scaffolded in F1 and will be implemented in {phase}.
      </p>
    </div>
  );
}
