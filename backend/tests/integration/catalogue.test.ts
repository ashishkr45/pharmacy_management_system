import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, closeDatabase, loginAs, resetDatabase, SEEDED_USERS } from '../helpers/index.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Catalogue suite (B4).
 *
 * Every test follows the same shape:
 *   1. arrange — log in / pick a category
 *   2. act     — send the request
 *   3. assert  — status, then error code OR response data, then side effects
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

interface MedicineDto {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  isActive: boolean;
  taxRate: string | null;
  defaultSalePrice: string | null;
  category: { id: number; name: string };
}

describe('catalogue', () => {
  let adminToken = '';
  let inventoryToken = '';
  let pharmacistToken = '';
  let analgesicsId = 0;

  beforeAll(async () => {
    await resetDatabase();
    adminToken = await loginAs(SEEDED_USERS.admin);
    inventoryToken = await loginAs(SEEDED_USERS.inventory);
    pharmacistToken = await loginAs(SEEDED_USERS.pharmacist);

    const categories = await api()
      .get('/api/v1/categories?search=Analgesics')
      .set('Authorization', bearer(adminToken));

    analgesicsId = (categories.body as ListBody<{ id: number }>).data[0]?.id ?? 0;
    expect(analgesicsId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('paginates medicines with the standard meta block', async () => {
    const response = await api()
      .get('/api/v1/medicines?page=2&pageSize=5')
      .set('Authorization', bearer(adminToken));

    expect(response.status).toBe(200);

    const body = response.body as ListBody<MedicineDto>;
    expect(body.data).toHaveLength(5);
    expect(body.meta).toEqual({ page: 2, pageSize: 5, total: 15, totalPages: 3 });
  });

  it('filters medicines and rejects an oversized page', async () => {
    // 1. search hits exactly the seeded medicine
    const searched = await api()
      .get('/api/v1/medicines?search=fevra')
      .set('Authorization', bearer(adminToken));

    expect(searched.status).toBe(200);
    const searchedBody = searched.body as ListBody<MedicineDto>;
    expect(searchedBody.meta.total).toBe(1);
    expect(searchedBody.data[0]?.name).toBe('Fevra-500');

    // 2. the fresh seed has no inactive medicine
    const inactive = await api()
      .get('/api/v1/medicines?isActive=false')
      .set('Authorization', bearer(adminToken));

    expect(inactive.status).toBe(200);
    expect((inactive.body as ListBody<MedicineDto>).meta.total).toBe(0);

    // 3. pageSize is capped at 100
    const tooBig = await api()
      .get('/api/v1/medicines?pageSize=101')
      .set('Authorization', bearer(adminToken));

    expect(tooBig.status).toBe(400);
    expect((tooBig.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a medicine, returns it from the detail endpoint and audits it', async () => {
    const created = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Test Medicine',
        genericName: 'Qatestine',
        sku: 'qa-test-1',
        categoryId: analgesicsId,
        unit: 'strip',
        reorderLevel: 10,
        taxRate: '5',
        defaultSalePrice: '12.50',
      });

    expect(created.status).toBe(201);

    const medicine = (created.body as { data: MedicineDto }).data;
    expect(medicine).toMatchObject({
      name: 'QA Test Medicine',
      sku: 'QA-TEST-1', // normalised to upper case
      categoryId: analgesicsId,
      isActive: true,
    });
    // Prisma Decimal serialises "12.50" as "12.5" and "5.00" as "5"
    expect(medicine.defaultSalePrice).toBe('12.5');
    expect(medicine.taxRate).toBe('5');

    // The detail endpoint returns the same row
    const detail = await api()
      .get(`/api/v1/medicines/${medicine.id}`)
      .set('Authorization', bearer(adminToken));

    expect(detail.status).toBe(200);
    expect((detail.body as { data: MedicineDto }).data.sku).toBe('QA-TEST-1');

    // The audit row was written in the same transaction as the insert
    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'MEDICINE', entityId: String(medicine.id), action: 'CREATE' },
      orderBy: { id: 'desc' },
    });

    expect(audit).not.toBeNull();
    expect((audit?.after as { sku?: string } | null)?.sku).toBe('QA-TEST-1');
  });

  it('rejects duplicate names and SKUs with 409', async () => {
    // same SKU, different case -> Zod upper-cases it, then the DB unique index fires
    const duplicateSku = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({ name: 'Another Medicine', sku: 'qa-test-1', categoryId: analgesicsId, unit: 'strip' });

    expect(duplicateSku.status).toBe(409);
    expect((duplicateSku.body as ErrorBody).error.code).toBe('CONFLICT');

    // category names are compared case-insensitively
    const duplicateCategory = await api()
      .post('/api/v1/categories')
      .set('Authorization', bearer(inventoryToken))
      .send({ name: 'analgesics' });

    expect(duplicateCategory.status).toBe(409);
    expect((duplicateCategory.body as ErrorBody).error.code).toBe('CONFLICT');

    // supplier names are compared case-insensitively as well
    const suppliers = await api()
      .get('/api/v1/suppliers?pageSize=1')
      .set('Authorization', bearer(adminToken));

    const existingSupplier = (suppliers.body as ListBody<{ name: string }>).data[0]?.name ?? '';
    const duplicateSupplier = await api()
      .post('/api/v1/suppliers')
      .set('Authorization', bearer(inventoryToken))
      .send({ name: existingSupplier.toLowerCase() });

    expect(duplicateSupplier.status).toBe(409);
    expect((duplicateSupplier.body as ErrorBody).error.code).toBe('CONFLICT');
  });

  it('returns 400 for invalid medicine payloads', async () => {
    const unknownCategory = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({ name: 'QA Bad Category', sku: 'QA-BADCAT-1', categoryId: 999999, unit: 'strip' });

    expect(unknownCategory.status).toBe(400);
    expect((unknownCategory.body as ErrorBody).error.details).toHaveProperty('categoryId');

    const emptySku = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({ name: 'QA No Sku', sku: '', categoryId: analgesicsId, unit: 'strip' });

    expect(emptySku.status).toBe(400);
    expect((emptySku.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const badPrice = await api()
      .post('/api/v1/medicines')
      .set('Authorization', bearer(inventoryToken))
      .send({
        name: 'QA Bad Price',
        sku: 'QA-BADPRICE-1',
        categoryId: analgesicsId,
        unit: 'strip',
        defaultSalePrice: '1.999', // more than 2 decimals
      });

    expect(badPrice.status).toBe(400);
  });

  it('forbids pharmacists from every catalogue write', async () => {
    const medicines = await api()
      .get('/api/v1/medicines?search=QA-TEST-1')
      .set('Authorization', bearer(adminToken));
    const medicineId = (medicines.body as ListBody<MedicineDto>).data[0]?.id ?? 0;

    const attempts = [
      api().post('/api/v1/categories').send({ name: 'Pharmacist Category' }),
      api().post('/api/v1/suppliers').send({ name: 'Pharmacist Supplier' }),
      api()
        .post('/api/v1/medicines')
        .send({ name: 'Pharmacist Medicine', sku: 'QA-PHARM-1', categoryId: analgesicsId, unit: 'strip' }),
      api().patch(`/api/v1/medicines/${medicineId}`).send({ isActive: false }),
    ];

    for (const attempt of attempts) {
      const response = await attempt.set('Authorization', bearer(pharmacistToken));
      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
    }
  });

  it('deactivates and reactivates a medicine and audits before/after', async () => {
    const medicines = await api()
      .get('/api/v1/medicines?search=QA-TEST-1')
      .set('Authorization', bearer(adminToken));
    const medicineId = (medicines.body as ListBody<MedicineDto>).data[0]?.id ?? 0;

    const deactivated = await api()
      .patch(`/api/v1/medicines/${medicineId}`)
      .set('Authorization', bearer(inventoryToken))
      .send({ isActive: false });

    expect(deactivated.status).toBe(200);
    expect((deactivated.body as { data: MedicineDto }).data.isActive).toBe(false);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'MEDICINE', entityId: String(medicineId), action: 'UPDATE' },
      orderBy: { id: 'desc' },
    });

    expect(audit).not.toBeNull();
    expect(audit?.before as object).toMatchObject({ isActive: true });
    expect(audit?.after as object).toMatchObject({ isActive: false });

    const reactivated = await api()
      .patch(`/api/v1/medicines/${medicineId}`)
      .set('Authorization', bearer(inventoryToken))
      .send({ isActive: true });

    expect(reactivated.status).toBe(200);
    expect((reactivated.body as { data: MedicineDto }).data.isActive).toBe(true);

    // an empty patch is a validation error, not a no-op
    const empty = await api()
      .patch(`/api/v1/medicines/${medicineId}`)
      .set('Authorization', bearer(inventoryToken))
      .send({});

    expect(empty.status).toBe(400);
    expect((empty.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('has no DELETE endpoint for medicines', async () => {
    const medicines = await api()
      .get('/api/v1/medicines?search=QA-TEST-1')
      .set('Authorization', bearer(adminToken));
    const medicineId = (medicines.body as ListBody<MedicineDto>).data[0]?.id ?? 0;

    const response = await api()
      .delete(`/api/v1/medicines/${medicineId}`)
      .set('Authorization', bearer(adminToken));

    expect(response.status).toBe(404);
    expect((response.body as ErrorBody).error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a missing medicine and 401 without a token', async () => {
    const missing = await api()
      .get('/api/v1/medicines/999999')
      .set('Authorization', bearer(adminToken));

    expect(missing.status).toBe(404);
    expect((missing.body as ErrorBody).error.code).toBe('NOT_FOUND');

    const patchMissing = await api()
      .patch('/api/v1/medicines/999999')
      .set('Authorization', bearer(adminToken))
      .send({ isActive: false });

    expect(patchMissing.status).toBe(404);

    const noToken = await api().get('/api/v1/medicines');

    expect(noToken.status).toBe(401);
    expect((noToken.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });
});
