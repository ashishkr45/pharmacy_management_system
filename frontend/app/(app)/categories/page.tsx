import type { Metadata } from "next";
import { Tags } from "lucide-react";
import { PhasePlaceholder } from "@/components/shared/phase-placeholder";

export const metadata: Metadata = { title: "Categories" };

export const instant = false;

export default function CategoriesPage() {
  return (
    <PhasePlaceholder
      phase="F2"
      title="Categories"
      description="Group medicines into categories and find them quickly when building the catalogue."
      icon={Tags}
    />
  );
}
