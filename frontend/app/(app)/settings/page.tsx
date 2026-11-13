import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export const instant = false;

export default function SettingsPage() {
  return (
    <RequireRole roles={["ADMIN"]}>
      <SettingsView />
    </RequireRole>
  );
}
