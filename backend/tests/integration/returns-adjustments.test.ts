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
 * Returns and stock adjustments: status transitions, over-return, concurrent
 * returns, original-batch restock, mandatory reasons, adjustment sign rules,
 * audit rows, RBAC and the ledger invariant.
 */

interface SaleItemDto {
  id: number;
  batchId: number;
  quantity: number;
  returnedQuantity: number;
}

interface SaleDto {
  id: number;
  invoiceNo: string;
  status: string;
  items: SaleItemDto[];
}

interface ReturnDto {
  id: number;
  saleItemId: number;
  quantity: number;
  reason: string;
  saleItem: { returnedQuantity: number; sale: { status: string } };
}

interface CreateReturnDto {
  saleId: number;
  invoiceNo: string;
  status: string;
  returns: ReturnDto[];
}

interface AdjustmentDto {
  id: number;
  batchId: number;
  delta: number;
  reasonCode: string;
  note: string | null;
  batch: { quantityOnHand: number };
}

interface MedicineDto {
  id: number;
}

const MAIN_SKU = 'QA-RET-1';

describe('returns and adjustments', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let inventoryToken = '';
  let supplierId = 0;
  let categoryId = 0;
  let medicineId = 0;
  let batchId = 0;
  let saleId = 0;
  let saleItemId = 0;

  async function receiveStock(
    token: string,
    targetMedicineId: number,
    batchNo: string,
    quantity: number,
    invoiceNo: string,
  ): Promise<{ batchId: number }> {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(token))
      .send({
        supplierId,
        supplierInvoiceNo: invoiceNo,
        items: [
          {
            medicineId: targetMedicineId,
            batchNo,
            quantity,
            costPrice: '50.00',
            salePrice: '100.00',
            expiryDate: '2027-05-31',
          },
        ],
      });
    expect(response.status).toBe(201);
    const purchase = dataOf<{ items: Array<{ batchId: number }> }>(response);
    return { batchId: purchase.items[0]?.batchId ?? 0 };
  }

  async function createSale(
    token: string,
    targetMedicineId: number,
    quantity: number,
    key: string,
  ): Promise<SaleDto> {
    const response = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(token))
      .set('Idempotency-Key', key)
      .send({ paymentMethod: 'CASH', items: [{ medicineId: targetMedicineId, quantity }] });
    expect(response.status).toBe(201);
    return dataOf<SaleDto>(response);
  }

  async function batchQty(id: number): Promise<number> {
    const batch = await prisma.batch.findUniqueOrThrow({ where: { id }, select: { quantityOnHand: true } });
    return batch.quantityOnHand;
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
        name: 'QA Return Medicine',
        sku: MAIN_SKU,
        categoryId,
        unit: 'strip',
        taxRate: '5',
        defaultSalePrice: '100.00',
      });
    expect(medicine.status).toBe(201);
    medicineId = dataOf<MedicineDto>(medicine).id;

    batchId = (await receiveStock(inventoryToken, medicineId, 'QA-RET-BATCH-1', 10, 'QA-INV-RET-1')).batchId;

    const sale = await createSale(pharmacistToken, medicineId, 6, 'qa-return-sale-1');
    saleId = sale.id;
    saleItemId = sale.items[0]?.id ?? 0;

    expect(supplierId).toBeGreaterThan(0);
    expect(categoryId).toBeGreaterThan(0);
    expect(saleItemId).toBeGreaterThan(0);
    expect(await batchQty(batchId)).toBe(4);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns part of a sale to the original batch and audits it', async () => {
    const response = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'Customer changed mind', items: [{ saleItemId, quantity: 2 }] });

    expect(response.status).toBe(201);
    const result = dataOf<CreateReturnDto>(response);
    expect(result.saleId).toBe(saleId);
    expect(result.status).toBe('PARTIALLY_RETURNED');
    expect(result.returns).toHaveLength(1);

    const returned = result.returns[0]!;
    expect(returned).toMatchObject({ saleItemId, quantity: 2, reason: 'Customer changed mind' });
    expect(returned.saleItem.returnedQuantity).toBe(2);
    expect(returned.saleItem.sale.status).toBe('PARTIALLY_RETURNED');

    // 10 received - 6 sold + 2 returned = 6
    expect(await batchQty(batchId)).toBe(6);

    const movements = await api()
      .get(`/api/v1/stock-movements?batchId=${batchId}&type=RETURN`)
      .set('Authorization', bearer(adminToken));
    const movement = listOf<{ qtyDelta: number; referenceType: string; referenceId: number }>(
      movements,
    ).data[0];
    expect(movement).toMatchObject({ qtyDelta: 2, referenceType: 'RETURN', referenceId: returned.id });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'RETURN', entityId: String(returned.id), action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.after).toMatchObject({ saleId, quantity: 2, batchId, quantityOnHand: 6 });

    const detail = await api()
      .get(`/api/v1/sales/${saleId}`)
      .set('Authorization', bearer(pharmacistToken));
    expect(dataOf<SaleDto>(detail).status).toBe('PARTIALLY_RETURNED');

    const history = await api()
      .get(`/api/v1/returns?saleId=${saleId}`)
      .set('Authorization', bearer(inventoryToken));
    expect(listOf<ReturnDto>(history).meta.total).toBe(1);

    expect(await countLedgerMismatches()).toBe(0);
  });

  it('caps returns at sold minus returned and reaches FULLY_RETURNED', async () => {
    const overReturn = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'Try to over-return', items: [{ saleItemId, quantity: 5 }] });

    expect(overReturn.status).toBe(409);
    const overError = errorOf(overReturn);
    expect(overError.code).toBe('INVALID_STATE');
    expect(overError.details).toMatchObject({ saleItemId, sold: 6, alreadyReturned: 2, requested: 5 });
    expect(await batchQty(batchId)).toBe(6);

    const final = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'Rest of the order cancelled', items: [{ saleItemId, quantity: 4 }] });

    expect(final.status).toBe(201);
    expect(dataOf<CreateReturnDto>(final).status).toBe('FULLY_RETURNED');
    expect(await batchQty(batchId)).toBe(10);

    const afterFull = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'Nothing left to return', items: [{ saleItemId, quantity: 1 }] });
    expect(afterFull.status).toBe(409);
    expect(errorOf(afterFull).details).toMatchObject({
      sold: 6,
      alreadyReturned: 6,
      requested: 1,
    });

    const missingReason = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ items: [{ saleItemId, quantity: 1 }] });
    expect(missingReason.status).toBe(400);
    expect(errorOf(missingReason).code).toBe('VALIDATION_ERROR');

    const duplicateLine = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({
        reason: 'Duplicate line',
        items: [
          { saleItemId, quantity: 1 },
          { saleItemId, quantity: 1 },
        ],
      });
    expect(duplicateLine.status).toBe(400);

    const foreignItem = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'Not my item', items: [{ saleItemId: 999999, quantity: 1 }] });
    expect(foreignItem.status).toBe(400);
    expect(errorOf(foreignItem).details).toMatchObject({ saleItemIds: [999999] });

    const unknownSale = await api()
      .post('/api/v1/sales/999999/returns')
      .set('Authorization', bearer(pharmacistToken))
      .send({ reason: 'No such sale', items: [{ saleItemId: 1, quantity: 1 }] });
    expect(unknownSale.status).toBe(404);

    const forbidden = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(inventoryToken))
      .send({ reason: 'Inventory manager cannot return', items: [{ saleItemId, quantity: 1 }] });
    expect(forbidden.status).toBe(403);

    const noToken = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .send({ reason: 'No token at all', items: [{ saleItemId, quantity: 1 }] });
    expect(noToken.status).toBe(401);

    expect(await countLedgerMismatches()).toBe(0);
  });

  it('allows only one of two concurrent returns that together exceed the cap', async () => {
    const medicine = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Return Concurrency',
        sku: 'QA-RET-CONC-1',
        categoryId,
        unit: 'strip',
        taxRate: '0',
      });
    expect(medicine.status).toBe(201);
    const concurrencyMedicineId = dataOf<MedicineDto>(medicine).id;

    const { batchId: concurrencyBatchId } = await receiveStock(
      inventoryToken,
      concurrencyMedicineId,
      'QA-RET-CONC-BATCH-1',
      10,
      'QA-INV-RET-CONC-1',
    );

    const sale = await createSale(pharmacistToken, concurrencyMedicineId, 5, 'qa-return-sale-conc-1');
    const concurrencySaleItemId = sale.items[0]!.id;

    const payload = { reason: 'Concurrent return', items: [{ saleItemId: concurrencySaleItemId, quantity: 4 }] };

    const [first, second] = await Promise.all([
      api()
        .post(`/api/v1/sales/${sale.id}/returns`)
        .set('Authorization', bearer(pharmacistToken))
        .send(payload),
      api()
        .post(`/api/v1/sales/${sale.id}/returns`)
        .set('Authorization', bearer(pharmacistToken))
        .send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failed = first.status === 409 ? first : second;
    expect(errorOf(failed).code).toBe('INVALID_STATE');

    // 10 received - 5 sold + 4 returned by the winner = 9
    expect(await batchQty(concurrencyBatchId)).toBe(9);

    const item = await prisma.saleItem.findUniqueOrThrow({
      where: { id: concurrencySaleItemId },
      select: { quantity: true, returnedQuantity: true },
    });
    expect(item).toEqual({ quantity: 5, returnedQuantity: 4 });

    const returnMovements = await prisma.stockMovement.count({
      where: { batchId: concurrencyBatchId, type: 'RETURN' },
    });
    expect(returnMovements).toBe(1);

    const detail = await api()
      .get(`/api/v1/sales/${sale.id}`)
      .set('Authorization', bearer(pharmacistToken));
    expect(dataOf<SaleDto>(detail).status).toBe('PARTIALLY_RETURNED');

    expect(await countLedgerMismatches()).toBe(0);
  });

  it('applies signed adjustments and rejects anything that would go below zero', async () => {
    // Batch is back at 10 after the full return in test 2.
    const damaged = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({ batchId, delta: -3, reasonCode: 'DAMAGED', note: 'Three strips crushed' });

    expect(damaged.status).toBe(201);
    const damagedAdjustment = dataOf<AdjustmentDto>(damaged);
    expect(damagedAdjustment).toMatchObject({ batchId, delta: -3, reasonCode: 'DAMAGED' });
    expect(damagedAdjustment.batch.quantityOnHand).toBe(7);
    expect(await batchQty(batchId)).toBe(7);

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: { batchId, type: 'ADJUSTMENT' },
      orderBy: { id: 'desc' },
    });
    expect(movement).toMatchObject({
      qtyDelta: -3,
      referenceType: 'ADJUSTMENT',
      referenceId: damagedAdjustment.id,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'ADJUSTMENT', entityId: String(damagedAdjustment.id), action: 'CREATE' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.before).toMatchObject({ quantityOnHand: 10 });
    expect(audit?.after).toMatchObject({ quantityOnHand: 7, delta: -3 });

    const found = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(adminToken))
      .send({ batchId, delta: 5, reasonCode: 'COUNT_CORRECTION', note: 'Found in the back room' });
    expect(found.status).toBe(201);
    expect(dataOf<AdjustmentDto>(found).batch.quantityOnHand).toBe(12);

    const belowZero = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({ batchId, delta: -999, reasonCode: 'LOST' });
    expect(belowZero.status).toBe(409);
    expect(errorOf(belowZero).code).toBe('INSUFFICIENT_STOCK');
    expect(errorOf(belowZero).details).toMatchObject({ available: 12, requested: 999 });
    expect(await batchQty(batchId)).toBe(12);

    const zeroDelta = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({ batchId, delta: 0, reasonCode: 'DAMAGED' });
    expect(zeroDelta.status).toBe(400);

    const otherWithoutNote = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({ batchId, delta: 1, reasonCode: 'OTHER' });
    expect(otherWithoutNote.status).toBe(400);
    expect(errorOf(otherWithoutNote).message).toContain('note');

    const unknownBatch = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({ batchId: 999999, delta: 1, reasonCode: 'DAMAGED' });
    expect(unknownBatch.status).toBe(404);

    const forbidden = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(pharmacistToken))
      .send({ batchId, delta: 1, reasonCode: 'DAMAGED' });
    expect(forbidden.status).toBe(403);

    const history = await api()
      .get(`/api/v1/adjustments?batchId=${batchId}`)
      .set('Authorization', bearer(pharmacistToken));
    expect(history.status).toBe(200);
    expect(listOf<AdjustmentDto>(history).meta.total).toBe(2);

    const filtered = await api()
      .get(`/api/v1/adjustments?batchId=${batchId}&reasonCode=DAMAGED`)
      .set('Authorization', bearer(adminToken));
    expect(listOf<AdjustmentDto>(filtered).meta.total).toBe(1);

    const noToken = await api().get('/api/v1/adjustments');
    expect(noToken.status).toBe(401);

    expect(await countLedgerMismatches()).toBe(0);
  });
});
