import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  bearer,
  closeDatabase,
  countLedgerMismatches,
  dataOf,
  errorOf,
  listOf,
  loginAs,
  resetDatabase,
  SEEDED_USERS,
} from '../helpers/index.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Sales: FEFO spill across batches, server-side pricing/tax, idempotency,
 * oversell and expired stock, concurrent sales, RBAC and ledger invariants.
 */

interface SaleItemDto {
  id: number;
  medicineId: number;
  batchId: number;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  batch: { id: number; batchNo: string; expiryDate: string };
}

interface SaleDto {
  id: number;
  invoiceNo: string;
  customerName: string | null;
  paymentMethod: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  status: string;
  items: SaleItemDto[];
}

interface PurchaseDto {
  items: Array<{ batchId: number; batch: { id: number; batchNo: string } }>;
}

interface MedicineDto {
  id: number;
  sku: string;
  isActive: boolean;
}

const MED_SKU = 'QA-SALE-1';
const BATCH_A = 'QA-SALE-BATCH-A'; // earliest expiry -> FEFO takes this first
const BATCH_B = 'QA-SALE-BATCH-B';
const CONC_SKU = 'QA-CONC-1';

describe('sales', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let inventoryToken = '';
  let supplierId = 0;
  let categoryId = 0;
  let medicineId = 0;
  let batchAId = 0;
  let batchBId = 0;
  let saleId = 0;
  let invoiceNo = '';

  const saleBody = (quantity: number) => ({
    customerName: 'QA Customer',
    customerPhone: '+91 00000 20001',
    paymentMethod: 'CASH',
    items: [{ medicineId, quantity }],
  });

  async function receiveStock(
    token: string,
    targetMedicineId: number,
    batchNo: string,
    quantity: number,
    costPrice: string,
    salePrice: string,
    expiryDate: string,
    invoiceNoValue: string,
  ): Promise<{ batchId: number }> {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(token))
      .send({
        supplierId,
        supplierInvoiceNo: invoiceNoValue,
        items: [
          {
            medicineId: targetMedicineId,
            batchNo,
            quantity,
            costPrice,
            salePrice,
            expiryDate,
          },
        ],
      });

    expect(response.status).toBe(201);
    const purchase = dataOf<PurchaseDto>(response);
    return { batchId: purchase.items[0]?.batchId ?? 0 };
  }

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await loginAs(SEEDED_USERS.admin);
    pharmacistToken = await loginAs(SEEDED_USERS.pharmacist);
    inventoryToken = await loginAs(SEEDED_USERS.inventory);

    const suppliers = await api()
      .get('/api/v1/suppliers?pageSize=1')
      .set('Authorization', bearer(adminToken));
    supplierId = listOf<{ id: number }>(suppliers).data[0]?.id ?? 0;

    const categories = await api()
      .get('/api/v1/categories?search=Analgesics')
      .set('Authorization', bearer(adminToken));
    categoryId = listOf<{ id: number }>(categories).data[0]?.id ?? 0;

    const medicine = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Sale Medicine',
        sku: MED_SKU,
        categoryId,
        unit: 'strip',
        taxRate: '5',
        defaultSalePrice: '100.00',
      });
    expect(medicine.status).toBe(201);
    medicineId = dataOf<MedicineDto>(medicine).id;

    batchAId = (
      await receiveStock(inventoryToken, medicineId, BATCH_A, 5, '60.00', '100.00', '2027-01-31', 'QA-INV-SALE-A')
    ).batchId;
    batchBId = (
      await receiveStock(inventoryToken, medicineId, BATCH_B, 10, '70.00', '120.00', '2027-06-30', 'QA-INV-SALE-B')
    ).batchId;

    expect(supplierId).toBeGreaterThan(0);
    expect(categoryId).toBeGreaterThan(0);
    expect(batchAId).toBeGreaterThan(0);
    expect(batchBId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('allocates FEFO across two batches and computes tax server-side', async () => {
    const response = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-1')
      .send(saleBody(8));

    expect(response.status).toBe(201);
    const sale = dataOf<SaleDto>(response);
    saleId = sale.id;
    invoiceNo = sale.invoiceNo;

    expect(invoiceNo).toMatch(/^INV-\d{4}-\d{6}$/);
    expect(sale.paymentMethod).toBe('CASH');
    expect(sale.status).toBe('COMPLETED');
    expect(sale.items).toHaveLength(2);

    // FEFO: 5 from batch A (earlier expiry), then 3 from batch B.
    expect(sale.items[0]).toMatchObject({ batchId: batchAId, quantity: 5, unitPrice: '100' });
    expect(sale.items[1]).toMatchObject({ batchId: batchBId, quantity: 3, unitPrice: '120' });

    // Tax-exclusive: 5% on each line, rounded per line.
    expect(sale.items[0]).toMatchObject({ taxRate: '5', taxAmount: '25', lineTotal: '525' });
    expect(sale.items[1]).toMatchObject({ taxRate: '5', taxAmount: '18', lineTotal: '378' });
    expect(sale.subtotal).toBe('860');
    expect(sale.taxTotal).toBe('43');
    expect(sale.total).toBe('903');

    // Batch quantities dropped
    const batchA = await api()
      .get(`/api/v1/batches/${batchAId}`)
      .set('Authorization', bearer(adminToken));
    const batchB = await api()
      .get(`/api/v1/batches/${batchBId}`)
      .set('Authorization', bearer(adminToken));
    expect(dataOf<{ quantityOnHand: number }>(batchA).quantityOnHand).toBe(0);
    expect(dataOf<{ quantityOnHand: number }>(batchB).quantityOnHand).toBe(7);

    // Two SALE movements, both pointing at this sale
    const movements = await api()
      .get(`/api/v1/stock-movements?batchId=${batchAId}`)
      .set('Authorization', bearer(adminToken));
    const movement = listOf<{ type: string; qtyDelta: number; referenceId: number }>(
      movements,
    ).data[0];
    expect(movement).toMatchObject({ type: 'SALE', qtyDelta: -5, referenceId: sale.id });

    expect(await countLedgerMismatches()).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'SALE', entityId: String(sale.id), action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
  });

  it('replays the same idempotency key and rejects a different payload', async () => {
    const replay = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-1')
      .send(saleBody(8));

    expect(replay.status).toBe(200);
    expect(replay.headers['idempotent-replay']).toBe('true');
    const replayedSale = dataOf<SaleDto>(replay);
    expect(replayedSale.id).toBe(saleId);
    expect(replayedSale.items).toHaveLength(2);

    // No extra stock was deducted
    const batchB = await api()
      .get(`/api/v1/batches/${batchBId}`)
      .set('Authorization', bearer(adminToken));
    expect(dataOf<{ quantityOnHand: number }>(batchB).quantityOnHand).toBe(7);

    const conflict = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-1')
      .send(saleBody(1));
    expect(conflict.status).toBe(409);
    expect(errorOf(conflict).code).toBe('IDEMPOTENCY_CONFLICT');

    const missingKey = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .send(saleBody(1));
    expect(missingKey.status).toBe(400);
    expect(errorOf(missingKey).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an oversell with INSUFFICIENT_STOCK and leaves stock untouched', async () => {
    const response = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-oversell')
      .send(saleBody(100));

    expect(response.status).toBe(409);
    const error = errorOf(response);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.details).toMatchObject({ requested: 100, available: 7 });

    const batchB = await api()
      .get(`/api/v1/batches/${batchBId}`)
      .set('Authorization', bearer(adminToken));
    expect(dataOf<{ quantityOnHand: number }>(batchB).quantityOnHand).toBe(7);
  });

  it('never sells expired stock', async () => {
    const medicine = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Expired Only',
        sku: 'QA-EXP-1',
        categoryId,
        unit: 'strip',
        taxRate: '5',
      });
    expect(medicine.status).toBe(201);
    const expiredMedicineId = dataOf<MedicineDto>(medicine).id;

    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: SEEDED_USERS.admin },
      select: { id: true },
    });

    // Fixture: an expired batch with stock and its OPENING ledger row.
    const expiredBatch = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          medicineId: expiredMedicineId,
          batchNo: 'QA-EXPIRED-1',
          expiryDate: new Date('2020-01-01T00:00:00.000Z'),
          quantityOnHand: 10,
          purchasePrice: '1.00',
          salePrice: '2.00',
        },
        select: { id: true },
      });
      await tx.stockMovement.create({
        data: {
          batchId: batch.id,
          type: 'OPENING',
          qtyDelta: 10,
          referenceType: 'OPENING',
          createdById: admin.id,
        },
      });
      return batch;
    });

    const response = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-expired')
      .send({
        paymentMethod: 'CASH',
        items: [{ medicineId: expiredMedicineId, quantity: 1 }],
      });

    expect(response.status).toBe(409);
    const error = errorOf(response);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.details).toMatchObject({ requested: 1, available: 0 });

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: expiredBatch.id },
      select: { quantityOnHand: true },
    });
    expect(batch.quantityOnHand).toBe(10);
    expect(await countLedgerMismatches()).toBe(0);
  });

  it('lets exactly one of two concurrent sales take the last units', async () => {
    const medicine = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Concurrency',
        sku: CONC_SKU,
        categoryId,
        unit: 'strip',
        taxRate: '0',
      });
    expect(medicine.status).toBe(201);
    const concurrencyMedicineId = dataOf<MedicineDto>(medicine).id;

    const { batchId } = await receiveStock(
      inventoryToken,
      concurrencyMedicineId,
      'QA-CONC-BATCH-1',
      5,
      '10.00',
      '20.00',
      '2027-03-31',
      'QA-INV-CONC-1',
    );

    const payload = {
      paymentMethod: 'CASH',
      items: [{ medicineId: concurrencyMedicineId, quantity: 5 }],
    };

    const [first, second] = await Promise.all([
      api()
        .post('/api/v1/sales')
        .set('Authorization', bearer(pharmacistToken))
        .set('Idempotency-Key', 'qa-conc-key-1')
        .send(payload),
      api()
        .post('/api/v1/sales')
        .set('Authorization', bearer(pharmacistToken))
        .set('Idempotency-Key', 'qa-conc-key-2')
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = first.status === 409 ? first : second;
    expect(errorOf(failed).code).toBe('INSUFFICIENT_STOCK');

    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      select: { quantityOnHand: true },
    });
    expect(batch.quantityOnHand).toBe(0);

    const saleMovements = await prisma.stockMovement.count({
      where: { batchId, type: 'SALE' },
    });
    expect(saleMovements).toBe(1);
    expect(await countLedgerMismatches()).toBe(0);
  });

  it('serves sale list, detail and invoice; enforces validation and RBAC', async () => {
    const listed = await api()
      .get('/api/v1/sales?search=INV-')
      .set('Authorization', bearer(inventoryToken));
    expect(listed.status).toBe(200);
    expect(listOf<SaleDto>(listed).meta.total).toBeGreaterThanOrEqual(2);

    const detail = await api()
      .get(`/api/v1/sales/${saleId}`)
      .set('Authorization', bearer(pharmacistToken));
    expect(detail.status).toBe(200);
    expect(dataOf<SaleDto>(detail).invoiceNo).toBe(invoiceNo);

    const invoice = await api()
      .get(`/api/v1/sales/${saleId}/invoice`)
      .set('Authorization', bearer(adminToken));
    expect(invoice.status).toBe(200);
    const invoiceBody = dataOf<SaleDto & { taxInclusive: boolean }>(invoice);
    expect(invoiceBody.taxInclusive).toBe(false);
    expect(invoiceBody.total).toBe('903');

    const missing = await api()
      .get('/api/v1/sales/999999')
      .set('Authorization', bearer(adminToken));
    expect(missing.status).toBe(404);

    const noToken = await api().get('/api/v1/sales');
    expect(noToken.status).toBe(401);

    const pharmacistForbidden = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(pharmacistToken))
      .send({ supplierId, supplierInvoiceNo: 'X', items: [] });
    expect(pharmacistForbidden.status).toBe(403);

    const zeroQty = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-invalid')
      .send({ paymentMethod: 'CASH', items: [{ medicineId, quantity: 0 }] });
    expect(zeroQty.status).toBe(400);

    const duplicateLine = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-duplicate')
      .send({
        paymentMethod: 'CASH',
        items: [
          { medicineId, quantity: 1 },
          { medicineId, quantity: 1 },
        ],
      });
    expect(duplicateLine.status).toBe(400);

    const unknownMedicine = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-unknown')
      .send({ paymentMethod: 'CASH', items: [{ medicineId: 999999, quantity: 1 }] });
    expect(unknownMedicine.status).toBe(400);
  });

  it('forbids inventory managers from creating sales and inactive medicines from being sold', async () => {
    const forbidden = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(inventoryToken))
      .set('Idempotency-Key', 'qa-sale-key-rbac')
      .send(saleBody(1));
    expect(forbidden.status).toBe(403);
    expect(errorOf(forbidden).code).toBe('FORBIDDEN');

    const deactivated = await api()
      .patch(`/api/v1/medicines/${medicineId}`)
      .set('Authorization', bearer(inventoryToken))
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);

    const inactive = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', 'qa-sale-key-inactive')
      .send(saleBody(1));
    expect(inactive.status).toBe(400);
    expect(errorOf(inactive).code).toBe('VALIDATION_ERROR');
  });
});
