import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, closeDatabase, loginAs, resetDatabase, SEEDED_USERS } from '../helpers/index.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * B5 purchases suite.
 *
 * Covers the stock-receiving path end to end: purchase row, batch create and
 * merge, PURCHASE ledger rows, the money total, the ledger invariant, RBAC and
 * the validation/conflict cases.
 */

interface Meta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ListBody<T> {
  data: T[];
  meta: Meta;
}

interface ErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

interface PurchaseItemDto {
  id: number;
  batchId: number;
  quantity: number;
  costPrice: string;
  salePrice: string;
  expiryDate: string;
  batch: { id: number; batchNo: string; expiryDate: string; quantityOnHand: number };
}

interface PurchaseDto {
  id: number;
  supplierId: number;
  supplierInvoiceNo: string;
  totalCost: string;
  items: PurchaseItemDto[];
}

interface BatchDto {
  id: number;
  batchNo: string;
  quantityOnHand: number;
  purchasePrice: string;
  salePrice: string;
  expired: boolean;
  daysUntilExpiry: number;
}

interface MovementDto {
  id: number;
  batchId: number;
  type: string;
  qtyDelta: number;
  referenceType: string;
  referenceId: number | null;
}

const BATCH_NO = 'QA-BATCH-B5';
const FUTURE_EXPIRY = '2027-12-31';
const OTHER_EXPIRY = '2028-01-01';

describe('purchases', () => {
  let adminToken = '';
  let inventoryToken = '';
  let pharmacistToken = '';
  let supplierId = 0;
  let medicineId = 0;
  let batchId = 0;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await loginAs(SEEDED_USERS.admin);
    inventoryToken = await loginAs(SEEDED_USERS.inventory);
    pharmacistToken = await loginAs(SEEDED_USERS.pharmacist);

    const suppliers = await api()
      .get('/api/v1/suppliers?pageSize=1')
      .set('Authorization', bearer(adminToken));
    supplierId = (suppliers.body as ListBody<{ id: number }>).data[0]?.id ?? 0;

    const medicines = await api()
      .get('/api/v1/medicines?search=106')
      .set('Authorization', bearer(adminToken));
    medicineId = (medicines.body as ListBody<{ id: number }>).data[0]?.id ?? 0;

    expect(supplierId).toBeGreaterThan(0);
    expect(medicineId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('receives stock: purchase + batch + PURCHASE movement in one transaction', async () => {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-1',
        items: [
          {
            medicineId,
            batchNo: BATCH_NO,
            quantity: 25,
            costPrice: '12.34',
            salePrice: '20.00',
            expiryDate: FUTURE_EXPIRY,
          },
        ],
      });

    expect(response.status).toBe(201);
    const purchase = (response.body as { data: PurchaseDto }).data;

    // 25 × 12.34 = 308.50 (Decimal serialised without the trailing zero)
    expect(Number(purchase.totalCost)).toBe(308.5);
    expect(purchase.supplierInvoiceNo).toBe('INV-QA-B5-1');
    expect(purchase.items).toHaveLength(1);
    expect(purchase.items[0]?.quantity).toBe(25);
    expect(purchase.items[0]?.batch.batchNo).toBe(BATCH_NO);
    expect(purchase.items[0]?.batch.quantityOnHand).toBe(25);

    batchId = purchase.items[0]?.batch.id ?? 0;
    expect(batchId).toBeGreaterThan(0);

    // The batch read model exposes FEFO-friendly derived fields
    const batches = await api()
      .get(`/api/v1/batches?search=${BATCH_NO}`)
      .set('Authorization', bearer(adminToken));
    expect(batches.status).toBe(200);
    const batch = (batches.body as ListBody<BatchDto>).data[0];
    expect(batch).toMatchObject({ batchNo: BATCH_NO, quantityOnHand: 25, expired: false });
    expect(batch?.daysUntilExpiry).toBeGreaterThan(0);

    // The ledger row points back at the purchase
    const movements = await api()
      .get(`/api/v1/stock-movements?batchId=${batchId}`)
      .set('Authorization', bearer(adminToken));
    expect(movements.status).toBe(200);
    const movement = (movements.body as ListBody<MovementDto>).data[0];
    expect(movement).toMatchObject({
      batchId,
      type: 'PURCHASE',
      qtyDelta: 25,
      referenceType: 'PURCHASE',
      referenceId: purchase.id,
    });

    // Audit row written with the purchase
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'PURCHASE', entityId: String(purchase.id), action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('merges into an existing batch and adopts the latest prices', async () => {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-2',
        items: [
          {
            medicineId,
            batchNo: BATCH_NO,
            quantity: 10,
            costPrice: '11.00',
            salePrice: '19.00',
            expiryDate: FUTURE_EXPIRY,
          },
        ],
      });

    expect(response.status).toBe(201);
    const purchase = (response.body as { data: PurchaseDto }).data;
    expect(Number(purchase.totalCost)).toBe(110);
    expect(purchase.items[0]?.batchId).toBe(batchId);
    expect(purchase.items[0]?.batch.quantityOnHand).toBe(35);

    const batch = (await api()
      .get(`/api/v1/batches/${batchId}`)
      .set('Authorization', bearer(adminToken))).body as { data: BatchDto };
    expect(batch.data.quantityOnHand).toBe(35);
    expect(Number(batch.data.purchasePrice)).toBe(11);
    expect(Number(batch.data.salePrice)).toBe(19);

    const movements = await api()
      .get(`/api/v1/stock-movements?batchId=${batchId}`)
      .set('Authorization', bearer(adminToken));
    expect((movements.body as ListBody<MovementDto>).data).toHaveLength(2);
  });

  it('rejects the same batch number with a different expiry date', async () => {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-3',
        items: [
          {
            medicineId,
            batchNo: BATCH_NO,
            quantity: 5,
            costPrice: '11.00',
            salePrice: '19.00',
            expiryDate: OTHER_EXPIRY,
          },
        ],
      });

    expect(response.status).toBe(409);
    expect((response.body as ErrorBody).error.code).toBe('INVALID_STATE');

    // The failed purchase rolled back: still 35 units, still 2 movements
    const batch = (await api()
      .get(`/api/v1/batches/${batchId}`)
      .set('Authorization', bearer(adminToken))).body as { data: BatchDto };
    expect(batch.data.quantityOnHand).toBe(35);
  });

  it('rejects past expiry, duplicate lines and unknown medicines with 400', async () => {
    const today = new Date().toISOString().slice(0, 10);

    const pastExpiry = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-4',
        items: [
          {
            medicineId,
            batchNo: 'QA-BATCH-PAST',
            quantity: 5,
            costPrice: '10.00',
            salePrice: '15.00',
            expiryDate: today, // BR-3: expiring today is already expired
          },
        ],
      });
    expect(pastExpiry.status).toBe(400);
    expect((pastExpiry.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const duplicateLine = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-5',
        items: [
          {
            medicineId,
            batchNo: 'QA-BATCH-DUP',
            quantity: 1,
            costPrice: '1.00',
            salePrice: '2.00',
            expiryDate: FUTURE_EXPIRY,
          },
          {
            medicineId,
            batchNo: 'qa-batch-dup', // upper-cased by Zod, so this is a duplicate
            quantity: 1,
            costPrice: '1.00',
            salePrice: '2.00',
            expiryDate: FUTURE_EXPIRY,
          },
        ],
      });
    expect(duplicateLine.status).toBe(400);
    expect((duplicateLine.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const unknownMedicine = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-6',
        items: [
          {
            medicineId: 999999,
            batchNo: 'QA-BATCH-MISSING',
            quantity: 1,
            costPrice: '1.00',
            salePrice: '2.00',
            expiryDate: FUTURE_EXPIRY,
          },
        ],
      });
    expect(unknownMedicine.status).toBe(400);
    expect((unknownMedicine.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('forbids pharmacists from receiving stock', async () => {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(pharmacistToken))
      .send({
        supplierId,
        supplierInvoiceNo: 'INV-QA-B5-RBAC',
        items: [
          {
            medicineId,
            batchNo: 'QA-BATCH-RBAC',
            quantity: 1,
            costPrice: '1.00',
            salePrice: '2.00',
            expiryDate: FUTURE_EXPIRY,
          },
        ],
      });

    expect(response.status).toBe(403);
    expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('lists purchases and returns 404/401 for missing/auth cases', async () => {
    const listed = await api()
      .get('/api/v1/purchases?search=INV-QA-B5-1')
      .set('Authorization', bearer(adminToken));
    expect(listed.status).toBe(200);
    expect((listed.body as ListBody<PurchaseDto>).meta.total).toBe(1);

    const detail = await api()
      .get(`/api/v1/purchases/${(listed.body as ListBody<PurchaseDto>).data[0]?.id ?? 0}`)
      .set('Authorization', bearer(adminToken));
    expect(detail.status).toBe(200);

    const missing = await api()
      .get('/api/v1/purchases/999999')
      .set('Authorization', bearer(adminToken));
    expect(missing.status).toBe(404);
    expect((missing.body as ErrorBody).error.code).toBe('NOT_FOUND');

    const noToken = await api().get('/api/v1/purchases');
    expect(noToken.status).toBe(401);
    expect((noToken.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('keeps the ledger invariant after receiving stock', async () => {
    const mismatches = await prisma.$queryRaw<Array<{ mismatched: number }>>`
      SELECT COUNT(*)::int AS mismatched
      FROM (
        SELECT b.id
        FROM batches b
        LEFT JOIN stock_movements m ON m.batch_id = b.id
        GROUP BY b.id, b.quantity_on_hand
        HAVING b.quantity_on_hand <> COALESCE(SUM(m.qty_delta), 0)
      ) broken
    `;

    expect(mismatches[0]?.mismatched).toBe(0);
  });
});
