import type { Metadata } from "next";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

// The dashboard loads its figures in the browser with the user's token, and
// the protected layout waits for the session check, so this route may block.
export const instant = false;

export default function DashboardPage() {
  return <DashboardView />;
}
