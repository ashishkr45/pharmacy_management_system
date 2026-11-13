"use client";

import Link from "next/link";
import { ArrowLeft, Printer, ReceiptText } from "lucide-react";
import type { InvoiceSale } from "@/lib/api/types";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiItem } from "@/lib/hooks/use-api-item";
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
} from "@/lib/sales";

function taxRateLabel(rate: string): string {
  const value = Number(rate);
  return Number.isFinite(value)
    ? `${new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2,
      }).format(value)}%`
    : `${rate}%`;
}

function InvoiceFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900">
      <p className="font-medium">Invoice unavailable</p>
      <p className="mt-1 text-sm text-neutral-600">{message}</p>
      <Link
        href="/sales"
        className="mt-4 inline-flex h-8 items-center gap-1 rounded-md bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-700"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to sales
      </Link>
    </div>
  );
}

export function InvoiceView({ saleId }: { saleId: number }) {
  const validId = Number.isInteger(saleId) && saleId > 0;
  const item = useApiItem<InvoiceSale>(
    validId ? `/sales/${saleId}/invoice` : null,
  );

  if (!validId) {
    return (
      <main className="min-h-svh bg-neutral-100 p-4 sm:p-8">
        <InvoiceFallback message="This invoice link is not valid." />
      </main>
    );
  }

  const invoice = item.data;

  return (
    <main className="min-h-svh bg-neutral-100 px-4 py-6 text-neutral-900 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/sales/${saleId}`}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-900 hover:bg-neutral-100"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to sale
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!invoice}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-700 disabled:pointer-events-none disabled:opacity-50"
        >
          <Printer className="size-3.5" aria-hidden="true" />
          Print invoice
        </button>
      </div>

      {item.isLoading ? (
        <div className="mx-auto max-w-3xl rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-600">Loading invoice...</p>
        </div>
      ) : item.error ? (
        <InvoiceFallback message={item.error} />
      ) : invoice ? (
        <article className="mx-auto max-w-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 sm:p-8 print:max-w-none print:p-0 print:shadow-none print:ring-0">
          <header className="flex flex-col gap-4 border-b border-neutral-300 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-neutral-900 text-white">
                  <ReceiptText className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-heading text-lg font-semibold tracking-tight">
                    MediTrack Pharmacy
                  </p>
                  <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-500">
                    Demo pharmacy
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-600">
                1 Example Market Road, Sample City 000000
                <br />
                Fictional data for assessment use only
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[0.6875rem] uppercase tracking-[0.12em] text-neutral-500">
                Sales invoice
              </p>
              <p className="font-mono text-sm font-semibold">
                {invoice.invoiceNo}
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                {formatDate(invoice.createdAt)}
              </p>
              <div className="mt-2">
                <span className="inline-flex h-5 items-center rounded-full bg-neutral-100 px-2 text-[0.625rem] font-medium text-neutral-800 ring-1 ring-neutral-300">
                  {SALE_STATUS_LABELS[invoice.status]}
                </span>
              </div>
            </div>
          </header>

          <section className="grid gap-4 border-b border-neutral-300 py-5 text-xs sm:grid-cols-3">
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-neutral-500">
                Bill to
              </p>
              <p className="mt-1 font-medium">
                {invoice.customerName ?? "Walk-in customer"}
              </p>
              <p className="text-neutral-600">
                {invoice.customerPhone ?? "No phone recorded"}
              </p>
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-neutral-500">
                Payment method
              </p>
              <p className="mt-1">{PAYMENT_METHOD_LABELS[invoice.paymentMethod]}</p>
              <p className="text-neutral-600">Label only; no payment processed</p>
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-wide text-neutral-500">
                Served by
              </p>
              <p className="mt-1">{invoice.createdBy.name}</p>
              <p className="text-neutral-600">
                {invoice.items.length} batch line
                {invoice.items.length === 1 ? "" : "s"}
              </p>
            </div>
          </section>

          <section className="py-5">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                Invoice lines for {invoice.invoiceNo}
              </caption>
              <thead>
                <tr className="border-b border-neutral-300 text-[0.625rem] uppercase tracking-wide text-neutral-500">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Medicine
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Batch / expiry
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    Unit price
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    Tax
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-3 text-right font-medium"
                  >
                    Line total (incl. tax)
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-neutral-200 align-top last:border-0"
                  >
                    <td className="py-3 pr-3">
                      <p className="font-medium">{line.medicine.name}</p>
                      <p className="font-mono text-[0.625rem] text-neutral-500">
                        {line.medicine.sku} · {line.medicine.unit}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[0.6875rem]">
                        {line.batch.batchNo}
                      </p>
                      <p className="text-[0.625rem] text-neutral-500">
                        Exp {formatDate(line.batch.expiryDate)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {line.quantity}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(line.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <p>{formatMoney(line.taxAmount)}</p>
                      <p className="text-[0.625rem] text-neutral-500">
                        {taxRateLabel(line.taxRate)}
                      </p>
                    </td>
                    <td className="py-3 pl-3 text-right font-medium tabular-nums">
                      {formatMoney(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="ml-auto max-w-xs space-y-2 border-t border-neutral-300 pt-4 text-xs">
            <div className="flex items-center justify-between gap-6">
              <span className="text-neutral-600">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(invoice.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-neutral-600">Tax</span>
              <span className="tabular-nums">
                {formatMoney(invoice.taxTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 border-t border-neutral-300 pt-2 text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-heading text-base font-semibold tabular-nums">
                {formatMoney(invoice.total)}
              </span>
            </div>
          </section>

          <footer className="mt-8 border-t border-neutral-300 pt-4 text-[0.625rem]/relaxed text-neutral-500">
            <p>
              Tax is shown on top of the line subtotal. Batch prices and tax
              rates were recorded by the server at the time of sale.
            </p>
            <p className="mt-1">
              This is a computer-generated demo invoice. No payment was
              processed. Fictional data for assessment use only.
            </p>
          </footer>
        </article>
      ) : null}
    </main>
  );
}
