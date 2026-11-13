import type { Metadata } from "next";
import { SaleDetailView } from "./sale-detail-view";

export const metadata: Metadata = { title: "Sale details" };

export const instant = false;

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const saleId = Number(id);

  return <SaleDetailView saleId={saleId} />;
}
