import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { AuditLogsView } from "./audit-logs-view";

export const metadata: Metadata = { title: "Audit log" };

export const instant = false;

export default function AuditLogsPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <AuditLogsView />
    </RequireRole>
  );
}
