import type { Metadata } from "next";
import { SuppliersView } from "./suppliers-view";

export const metadata: Metadata = { title: "Suppliers" };

export const instant = false;

export default function SuppliersPage() {
  return <SuppliersView />;
}
