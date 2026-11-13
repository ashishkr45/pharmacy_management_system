import type { Metadata } from "next";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Reports" };

export const instant = false;

export default function ReportsPage() {
  return <ReportsView />;
}
