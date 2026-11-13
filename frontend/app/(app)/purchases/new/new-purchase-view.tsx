"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import type { Medicine, Supplier } from "@/lib/api/types";
import {
  REFERENCE_DATA_STALE_TIME,
  useApiList,
} from "@/lib/hooks/use-api-list";

export function NewPurchaseView() {
  const suppliersList = useApiList<Supplier>(
    "/suppliers?isActive=true&pageSize=100",
    { staleTime: REFERENCE_DATA_STALE_TIME },
  );
  const medicinesList = useApiList<Medicine>(
    "/medicines?isActive=true&pageSize=100",
    { staleTime: REFERENCE_DATA_STALE_TIME },
  );

  const suppliers = useMemo(
    () => suppliersList.data?.data ?? [],
    [suppliersList.data],
  );
  const medicines = useMemo(
    () => medicinesList.data?.data ?? [],
    [medicinesList.data],
  );

  const isLoading = suppliersList.isLoading || medicinesList.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receive purchase"
        description="Record a supplier invoice. The server merges matching batches and writes the stock ledger entries atomically."
        actions={
          <Link
            href="/purchases"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to purchases
          </Link>
        }
      />

      {suppliersList.error ? (
        <Alert variant="destructive">
          <AlertTitle>Suppliers could not be loaded</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{suppliersList.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suppliersList.reload}
            >
              Retry suppliers
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {medicinesList.error ? (
        <Alert variant="destructive">
          <AlertTitle>Medicines could not be loaded</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{medicinesList.error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={medicinesList.reload}
            >
              Retry medicines
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !suppliersList.error && suppliers.length === 0 ? (
        <Alert>
          <AlertTitle>No active suppliers</AlertTitle>
          <AlertDescription>
            Add an active supplier in{" "}
            <Link href="/suppliers" className="underline underline-offset-4">
              the supplier catalogue
            </Link>{" "}
            before receiving stock.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !medicinesList.error && medicines.length === 0 ? (
        <Alert>
          <AlertTitle>No active medicines</AlertTitle>
          <AlertDescription>
            Add an active medicine in{" "}
            <Link href="/medicines" className="underline underline-offset-4">
              the medicine catalogue
            </Link>{" "}
            before receiving stock.
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <LoadingState label="Loading suppliers and medicines..." />
      ) : (
        <PurchaseForm suppliers={suppliers} medicines={medicines} />
      )}
    </div>
  );
}
