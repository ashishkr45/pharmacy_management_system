import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { InvoiceView } from "./invoice-view";

export const metadata: Metadata = {
  title: "Sales invoice",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const saleId = Number(id);

  return (
    <RequireAuth>
      <InvoiceView saleId={saleId} />
    </RequireAuth>
  );
}
