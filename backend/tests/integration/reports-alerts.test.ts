import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  bearer,
  closeDatabase,
  dataOf,
  errorOf,
  listOf,
  loginAs,
  resetDatabase,
  SEEDED_USERS,
} from '../helpers/index.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * B8: alerts, dashboard, sales/valuation/expiry reports, reconciliation,
 * settings and the audit-log UI feed. Covers acceptance A3 (ledger
 * reconciliation after opening + purchase + sale + return + adjustment) and
 * A5 (report RBAC).
 */

const RPT_SKU = 'QA-RPT-1';
const RPT_BATCH = 'QA-RPT-BATCH-1';
const RPT_INVOICE = 'QA-INV-RPT-1';
const RPT_SALE_KEY = 'qa-report-sale-1';

/** Calendar day `offset` days from today, as the API's YYYY-MM-DD. */
function utcDay(offset = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const FROM = utcDay(-3);
const TO = utcDay(3);

interface LowStockItem {
  medicineId: number;
  name: string;
  sku: string;
  reorderLevel: number;
  availableQuantity: number;
  expiredQuantity: number;
  shortfall: number;
}

interface ExpiryAlertItem {
  batchId: number;
  batchNo: string;
  quantityOnHand: number;
  daysUntilExpiry: number;
  expired: boolean;
  medicine: { id: number; name: string; sku: string };
}

interface AlertListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  nearExpiryDays?: number;
}

interface DashboardSummary {
  date: string;
  todaySales: { count: number; subtotal: string; taxTotal: string; total: string };
  alerts: { lowStock: number; nearExpiry: number; expired: number };
}

interface SaleItemDto {
  id: number;
  batchId: number;
  quantity: number;
  lineTotal: string;
}

interface SaleDto {
  id: number;
  invoiceNo: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  items: SaleItemDto[];
}

interface CreateReturnDto {
  saleId: number;
  status: string;
  returns: Array<{ id: number; saleItemId: number; quantity: number }>;
}

interface SalesReport {
  from: string;
  to: string;
  totals: {
    saleCount: number;
    subtotal: string;
    taxTotal: string;
    total: string;
    returnCount: number;
    returnedUnits: number;
    returnedValue: string;
  };
  breakdown: Array<{ date: string; saleCount: number; total: string }>;
}

interface StockValuation {
  rows: Array<{
    batchId: number;
    batchNo: string;
    quantityOnHand: number;
    purchasePrice: string;
    salePrice: string;
    costValue: string;
    retailValue: string;
  }>;
  totals: { batches: number; units: number; costValue: string; retailValue: string };
}

interface ExpiryReport {
  windowDays: number;
  expired: { batches: number; units: number; costValue: string };
  nearExpiry: { batches: number; units: number; costValue: string };
  groups: Array<{
    medicineId: number;
    name: string;
    expiredUnits: number;
    nearExpiryUnits: number;
    costValueAtRisk: string;
  }>;
}

interface Reconciliation {
  from: string;
  to: string;
  checksCurrent: boolean;
  checkedBatches: number;
  mismatchCount: number;
  mismatches: Array<{
    batchId: number;
    opening: number;
    purchases: number;
    sales: number;
    returns: number;
    adjustments: number;
    closing: number;
    currentQuantity: number;
    difference: number;
  }>;
}

interface Settings {
  defaultTaxRate: string;
  nearExpiryDays: number;
}

interface AuditLogRow {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  user: { id: number; email: string };
}

describe('alerts, dashboard, reports and settings', () => {
  let adminToken = '';
  let pharmacistToken = '';
  let inventoryToken = '';
  let supplierId = 0;
  let categoryId = 0;
  let medicineId = 0;
  let batchId = 0;
  let saleId = 0;
  let saleItemId = 0;

  async function receiveStock(): Promise<void> {
    const response = await api()
      .post('/api/v1/purchases')
      .set('Authorization', bearer(inventoryToken))
      .send({
        supplierId,
        supplierInvoiceNo: RPT_INVOICE,
        items: [
          {
            medicineId,
            batchNo: RPT_BATCH,
            quantity: 10,
            costPrice: '10.00',
            salePrice: '20.00',
            expiryDate: utcDay(200),
          },
        ],
      });

    expect(response.status).toBe(201);
    const purchase = dataOf<{ items: Array<{ batchId: number }> }>(response);
    batchId = purchase.items[0]?.batchId ?? 0;
    expect(batchId).toBeGreaterThan(0);
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
        name: 'QA Report Medicine',
        sku: RPT_SKU,
        categoryId,
        unit: 'strip',
        reorderLevel: 100,
        taxRate: '5',
        defaultSalePrice: '20.00',
      });

    expect(medicine.status).toBe(201);
    medicineId = dataOf<{ id: number }>(medicine).id;

    expect(supplierId).toBeGreaterThan(0);
    expect(categoryId).toBeGreaterThan(0);
    expect(medicineId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('lists low-stock, near-expiry and expired alerts and matches dashboard counts', async () => {
    const lowStock = await api()
      .get('/api/v1/alerts/low-stock?pageSize=100')
      .set('Authorization', bearer(pharmacistToken));
    expect(lowStock.status).toBe(200);
    const low = listOf<LowStockItem>(lowStock);

    // Expired-only stock must not hide the shortage.
    expect(low.data.find((item) => item.sku === 'MED-008')).toMatchObject({
      availableQuantity: 8,
      reorderLevel: 20,
      shortfall: 12,
      expiredQuantity: 0,
    });
    expect(low.data.find((item) => item.sku === 'MED-005')).toMatchObject({
      availableQuantity: 0,
      expiredQuantity: 30,
      shortfall: 30,
    });

    const nearExpiry = await api()
      .get('/api/v1/alerts/near-expiry?pageSize=100')
      .set('Authorization', bearer(pharmacistToken));
    expect(nearExpiry.status).toBe(200);
    const near = listOf<ExpiryAlertItem>(nearExpiry);
    const milkBatch = near.data.find((item) => item.batchNo === 'MILK-2601');
    expect(milkBatch).toMatchObject({
      quantityOnHand: 40,
      daysUntilExpiry: 20,
      expired: false,
      medicine: { sku: '106-MILK' },
    });
    expect(near.data.every((item) => item.daysUntilExpiry > 0)).toBe(true);
    expect(near.meta.nearExpiryDays).toBe(60);

    const expired = await api()
      .get('/api/v1/alerts/expired?pageSize=100')
      .set('Authorization', bearer(adminToken));
    const old = listOf<ExpiryAlertItem>(expired);
    expect(old.data.find((item) => item.batchNo === 'CTZ-2512')).toMatchObject({
      quantityOnHand: 30,
      daysUntilExpiry: -20,
      expired: true,
      medicine: { sku: 'MED-005' },
    });

    const dashboard = await api()
      .get('/api/v1/dashboard/summary')
      .set('Authorization', bearer(pharmacistToken));
    expect(dashboard.status).toBe(200);
    const summary = dataOf<DashboardSummary>(dashboard);
    expect(summary.todaySales).toEqual({
      count: 0,
      subtotal: '0.00',
      taxTotal: '0.00',
      total: '0.00',
    });
    expect(summary.alerts).toEqual({
      lowStock: low.meta.total,
      nearExpiry: near.meta.total,
      expired: old.meta.total,
    });
  });

  it('honours the near-expiry setting', async () => {
    const narrow = await api()
      .put('/api/v1/settings')
      .set('Authorization', bearer(adminToken))
      .send({ nearExpiryDays: 10 });
    expect(narrow.status).toBe(200);

    try {
      const response = await api()
        .get('/api/v1/alerts/near-expiry?pageSize=100')
        .set('Authorization', bearer(pharmacistToken));
      const result = listOf<ExpiryAlertItem>(response);
      expect(result.meta.nearExpiryDays).toBe(10);
      expect(result.meta.total).toBe(0);
    } finally {
      await api()
        .put('/api/v1/settings')
        .set('Authorization', bearer(adminToken))
        .send({ nearExpiryDays: 60 });
    }
  });

  it('reconciles opening, purchase, sale, return and adjustment with zero mismatch (A5)', async () => {
    await receiveStock();

    const adjustment = await api()
      .post('/api/v1/adjustments')
      .set('Authorization', bearer(inventoryToken))
      .send({
        batchId,
        delta: 2,
        reasonCode: 'COUNT_CORRECTION',
        note: 'QA report count correction',
      });
    expect(adjustment.status).toBe(201);

    const saleResponse = await api()
      .post('/api/v1/sales')
      .set('Authorization', bearer(pharmacistToken))
      .set('Idempotency-Key', RPT_SALE_KEY)
      .send({ paymentMethod: 'CASH', items: [{ medicineId, quantity: 4 }] });

    expect(saleResponse.status).toBe(201);
    const sale = dataOf<SaleDto>(saleResponse);
    saleId = sale.id;
    saleItemId = sale.items[0]?.id ?? 0;
    expect(sale).toMatchObject({ subtotal: '80', taxTotal: '4', total: '84' });

    const returned = await api()
      .post(`/api/v1/sales/${saleId}/returns`)
      .set('Authorization', bearer(pharmacistToken))
      .send({
        reason: 'QA report return',
        items: [{ saleItemId, quantity: 1 }],
      });
    expect(returned.status).toBe(201);

    // 10 received + 2 adjustment - 4 sold + 1 returned = 9
    const batch = await prisma.batch.findUniqueOrThrow({
      where: { id: batchId },
      select: { quantityOnHand: true },
    });
    expect(batch.quantityOnHand).toBe(9);

    const reconciliation = await api()
      .get(`/api/v1/reports/reconciliation?from=${FROM}&to=${TO}`)
      .set('Authorization', bearer(adminToken));
    expect(reconciliation.status).toBe(200);
    const report = dataOf<Reconciliation>(reconciliation);
    expect(report).toMatchObject({
      from: FROM,
      to: TO,
      checksCurrent: true,
      mismatchCount: 0,
    });
    expect(report.checkedBatches).toBeGreaterThan(0);
    expect(report.mismatches).toEqual([]);
  });

  it('detects a corrupted batch balance and reports the difference', async () => {
    // Test-only corruption: production code may only change stock through the
    // movement service. This proves the reconciliation query is not a no-op.
    await prisma.batch.update({ where: { id: batchId }, data: { quantityOnHand: 10 } });

    try {
      const response = await api()
        .get(`/api/v1/reports/reconciliation?from=${FROM}&to=${TO}`)
        .set('Authorization', bearer(adminToken));

      expect(response.status).toBe(200);
      const report = dataOf<Reconciliation>(response);
      expect(report.mismatchCount).toBe(1);
      expect(report.mismatches[0]).toMatchObject({
        batchId,
        opening: 0,
        purchases: 10,
        sales: 4,
        returns: 1,
        adjustments: 2,
        closing: 9,
        currentQuantity: 10,
        difference: -1,
      });
    } finally {
      await prisma.batch.update({ where: { id: batchId }, data: { quantityOnHand: 9 } });
    }

    const repaired = await api()
      .get(`/api/v1/reports/reconciliation?from=${FROM}&to=${TO}`)
      .set('Authorization', bearer(adminToken));
    expect(dataOf<Reconciliation>(repaired).mismatchCount).toBe(0);
  });

  it('reports daily sales with returns, stock valuation and expiry exposure', async () => {
    const salesReport = await api()
      .get(`/api/v1/reports/sales?from=${FROM}&to=${TO}`)
      .set('Authorization', bearer(pharmacistToken));
    expect(salesReport.status).toBe(200);
    const sales = dataOf<SalesReport>(salesReport);
    expect(sales.totals).toMatchObject({
      saleCount: 1,
      subtotal: '80.00',
      taxTotal: '4.00',
      total: '84.00',
      returnCount: 1,
      returnedUnits: 1,
      returnedValue: '21.00',
    });
    expect(sales.breakdown).toHaveLength(1);
    expect(sales.breakdown[0]).toMatchObject({ saleCount: 1, total: '84.00' });

    const valuationResponse = await api()
      .get('/api/v1/reports/stock-valuation')
      .set('Authorization', bearer(inventoryToken));
    expect(valuationResponse.status).toBe(200);
    const valuation = dataOf<StockValuation>(valuationResponse);
    const row = valuation.rows.find((item) => item.batchNo === RPT_BATCH);
    expect(row).toMatchObject({
      quantityOnHand: 9,
      purchasePrice: '10.00',
      salePrice: '20.00',
      costValue: '90.00',
      retailValue: '180.00',
    });
    expect(valuation.totals.units).toBeGreaterThanOrEqual(9);

    const expiryResponse = await api()
      .get('/api/v1/reports/expiry?days=365')
      .set('Authorization', bearer(inventoryToken));
    expect(expiryResponse.status).toBe(200);
    const expiry = dataOf<ExpiryReport>(expiryResponse);
    expect(expiry.windowDays).toBe(365);
    const group = expiry.groups.find((item) => item.medicineId === medicineId);
    expect(group).toMatchObject({
      name: 'QA Report Medicine',
      expiredUnits: 0,
      nearExpiryUnits: 9,
    });
    expect(Number(group?.costValueAtRisk)).toBe(90);
  });

  it('enforces report and admin RBAC and rejects invalid ranges', async () => {
    const salesUrl = `/api/v1/reports/sales?from=${FROM}&to=${TO}`;
    const valuationUrl = '/api/v1/reports/stock-valuation';
    const expiryUrl = '/api/v1/reports/expiry';
    const reconciliationUrl = `/api/v1/reports/reconciliation?from=${FROM}&to=${TO}`;

    // PHARMACIST: sales report yes, stock reports no.
    expect(
      (await api().get(salesUrl).set('Authorization', bearer(pharmacistToken))).status,
    ).toBe(200);
    for (const url of [valuationUrl, expiryUrl, reconciliationUrl]) {
      const response = await api().get(url).set('Authorization', bearer(pharmacistToken));
      expect(response.status).toBe(403);
      expect(errorOf(response).code).toBe('FORBIDDEN');
    }

    // INVENTORY_MANAGER: stock reports yes, sales report no.
    expect(
      (await api().get(salesUrl).set('Authorization', bearer(inventoryToken))).status,
    ).toBe(403);
    for (const url of [valuationUrl, expiryUrl, reconciliationUrl]) {
      expect(
        (await api().get(url).set('Authorization', bearer(inventoryToken))).status,
      ).toBe(200);
    }

    // ADMIN: everything.
    for (const url of [salesUrl, valuationUrl, expiryUrl, reconciliationUrl]) {
      expect((await api().get(url).set('Authorization', bearer(adminToken))).status).toBe(200);
    }

    // Alerts and dashboard are available to every authenticated role.
    for (const token of [adminToken, pharmacistToken, inventoryToken]) {
      expect(
        (await api().get('/api/v1/alerts/low-stock').set('Authorization', bearer(token))).status,
      ).toBe(200);
      expect(
        (await api().get('/api/v1/dashboard/summary').set('Authorization', bearer(token))).status,
      ).toBe(200);
    }

    // Audit logs and settings are ADMIN-only.
    for (const token of [pharmacistToken, inventoryToken]) {
      expect(
        (await api().get('/api/v1/audit-logs').set('Authorization', bearer(token))).status,
      ).toBe(403);
      expect(
        (await api().get('/api/v1/settings').set('Authorization', bearer(token))).status,
      ).toBe(403);
      expect(
        (
          await api()
            .put('/api/v1/settings')
            .set('Authorization', bearer(token))
            .send({ nearExpiryDays: 30 })
        ).status,
      ).toBe(403);
    }
    expect(
      (await api().get('/api/v1/audit-logs').set('Authorization', bearer(adminToken))).status,
    ).toBe(200);
    expect(
      (await api().get('/api/v1/settings').set('Authorization', bearer(adminToken))).status,
    ).toBe(200);

    // No token and invalid ranges/values are rejected.
    expect((await api().get(salesUrl)).status).toBe(401);

    for (const url of [
      '/api/v1/reports/sales?from=2026-12-31&to=2026-01-01',
      '/api/v1/reports/reconciliation?from=2026-12-31&to=2026-01-01',
    ]) {
      const response = await api().get(url).set('Authorization', bearer(adminToken));
      expect(response.status).toBe(400);
      expect(errorOf(response).code).toBe('VALIDATION_ERROR');
    }

    const badTax = await api()
      .put('/api/v1/settings')
      .set('Authorization', bearer(adminToken))
      .send({ defaultTaxRate: 150 });
    expect(badTax.status).toBe(400);
    expect(errorOf(badTax).code).toBe('VALIDATION_ERROR');
  });

  it('updates settings and records before/after in the audit log', async () => {
    const before = await api()
      .get('/api/v1/settings')
      .set('Authorization', bearer(adminToken));
    expect(dataOf<Settings>(before)).toEqual({
      defaultTaxRate: '5.00',
      nearExpiryDays: 60,
    });

    const update = await api()
      .put('/api/v1/settings')
      .set('Authorization', bearer(adminToken))
      .send({ nearExpiryDays: 45 });

    expect(update.status).toBe(200);
    expect(dataOf<Settings>(update).nearExpiryDays).toBe(45);

    try {
      const logs = await api()
        .get(
          '/api/v1/audit-logs?entityType=SETTING&action=UPDATE&entityId=nearExpiryDays&pageSize=10',
        )
        .set('Authorization', bearer(adminToken));

      expect(logs.status).toBe(200);
      const page = listOf<AuditLogRow>(logs);
      expect(page.meta.total).toBeGreaterThanOrEqual(1);
      expect(page.data[0]).toMatchObject({
        action: 'UPDATE',
        entityType: 'SETTING',
        entityId: 'nearExpiryDays',
        before: { key: 'nearExpiryDays', value: '60' },
        after: { key: 'nearExpiryDays', value: '45' },
        user: { email: SEEDED_USERS.admin },
      });
    } finally {
      await api()
        .put('/api/v1/settings')
        .set('Authorization', bearer(adminToken))
        .send({ nearExpiryDays: 60 });
    }
  });
});
