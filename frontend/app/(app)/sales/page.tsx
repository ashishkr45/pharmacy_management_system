import type { Metadata } from "next";
import { SalesView } from "./sales-view";

export const metadata: Metadata = { title: "Sales" };

export const instant = false;

export default function SalesPage() {
  return <SalesView />;
}
