import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Audit log" };

export const instant = false;

export default function AuditLogsPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <PhasePlaceholder
        phase="F6"
        title="Audit log"
        description="Trace who changed what, with before and after values for every material action."
        icon={ScrollText}
      />
    </RequireRole>
  );
}
