import Link from "next/link";
import { Pill } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  href,
  className,
  tone = "default",
  onClick,
}: {
  href?: string;
  className?: string;
  tone?: "default" | "inverted";
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
          tone === "inverted"
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground",
        )}
      >
        <Pill className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            "block font-heading text-sm font-semibold tracking-tight",
            tone === "inverted" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          MediTrack
        </span>
        <span
          className={cn(
            "block truncate text-[0.625rem]",
            tone === "inverted"
              ? "text-primary-foreground/70"
              : "text-muted-foreground",
          )}
        >
          Pharmacy management
        </span>
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>{content}</div>
  );
}
