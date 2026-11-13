"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rangeValidationError } from "@/lib/reports";

/** Date-only filters shared by the sales and reconciliation reports. */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
}) {
  const errorId = useId();
  const error = rangeValidationError(from, to);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="w-full space-y-1 text-xs font-medium text-muted-foreground sm:w-auto">
          <span>From</span>
          <Input
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            className="w-full sm:w-36"
            aria-label="Report from date"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <label className="w-full space-y-1 text-xs font-medium text-muted-foreground sm:w-auto">
          <span>To</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            className="w-full sm:w-36"
            aria-label="Report to date"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Reset range
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
