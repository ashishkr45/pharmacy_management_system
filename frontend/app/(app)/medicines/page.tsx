import type { Metadata } from "next";
import { Pill } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Medicines" };

export const instant = false;

export default function MedicinesPage() {
  return (
    <PhasePlaceholder
      phase="F2"
      title="Medicines"
      description="Search the catalogue, create medicines and update prices, tax rates and active status."
      icon={Pill}
    />
  );
}
