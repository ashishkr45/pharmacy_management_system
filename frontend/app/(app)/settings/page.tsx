import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Settings" };

export const instant = false;

export default function SettingsPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <PhasePlaceholder
        phase="F6"
        title="Settings"
        description="Adjust the default tax rate and the near-expiry window used by alerts."
        icon={Settings}
      />
    </RequireRole>
  );
}
