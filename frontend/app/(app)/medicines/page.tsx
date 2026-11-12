import type { Metadata } from "next";
import { MedicinesView } from "./medicines-view";

export const metadata: Metadata = { title: "Medicines" };

export const instant = false;

export default function MedicinesPage() {
  return <MedicinesView />;
}
