import type { Metadata } from "next";
import { AlertsView } from "./alerts-view";

export const metadata: Metadata = { title: "Alerts" };

export const instant = false;

export default function AlertsPage() {
  return <AlertsView />;
}
