/**
 * Demo seed — fictional data only, dummy credentials.
 *
 * Run with: npm run db:seed  (configured as `tsx prisma/seed.ts`).
 * Safe to re-run: it wipes the tables in FK order, then re-inserts.
 *
 * Every batch's quantity_on_hand is paired with exactly one OPENING movement,
 * so the ledger invariant (SUM(qty_delta) = quantity_on_hand) holds from the
 * very first row. Batches deliberately cover the three alert cases:
 *   - expired with stock   -> Cetzine-10 (only stock, so it cannot be sold)
 *   - near-expiry (<= 60d) -> Fevra-500 (+20d), Glycibal-2 (+60d), Cofrelief (+45d)
 *   - low stock            -> D3 Rise (8/20), Glycibal-2 (10/25), Digestaid (10/15)
 */
import bcrypt from 'bcrypt';
import { pathToFileURL } from 'node:url';
import { disconnectPrisma, prisma } from '../src/db/prisma.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { addDays, startOfToday } from '../src/utils/clock.js';

const { Decimal } = Prisma;

const DEMO_PASSWORD = 'Demo@1234';

/** Days from today -> calendar day (UTC midnight) stored in a DATE column. */
function inDays(days: number): Date {
  return addDays(startOfToday(), days);
}

function money(value: string): Prisma.Decimal {
  return new Decimal(value);
}

async function clearAll(): Promise<void> {
  // Children first — FK constraints are RESTRICT.
  await prisma.return.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedDatabase(): Promise<void> {
  await clearAll();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.createMany({
    data: [
      { name: 'Aarav Mehta (Admin)', email: 'admin@pharmacy.test', passwordHash, role: 'ADMIN' },
      { name: 'Priya Nair (Pharmacist)', email: 'pharmacist@pharmacy.test', passwordHash, role: 'PHARMACIST' },
      { name: 'Rohan Desai (Inventory)', email: 'inventory@pharmacy.test', passwordHash, role: 'INVENTORY_MANAGER' },
    ],
  });

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@pharmacy.test' } });

  const categories = await Promise.all(
    ['Analgesics', 'Antibiotics', 'Antihistamines', 'Vitamins', 'Gastro', 'Diabetes', 'Respiratory'].map((name) =>
      prisma.category.create({ data: { name } }),
    ),
  );
  const categoryId = new Map(categories.map((category) => [category.name, category.id]));

  const suppliers = await Promise.all(
    [
      { name: 'Meridian Pharma Distributors', contactPerson: 'Nisha Rao', phone: '+91 00000 10001', email: 'orders@meridian.example', address: '12 Industrial Estate, Pune' },
      { name: 'BlueLeaf Healthcare Supplies', contactPerson: 'Vikram Shah', phone: '+91 00000 10002', email: 'sales@blueleaf.example', address: '48 Trade Centre, Ahmedabad' },
      { name: 'Crescent Medical Agencies', contactPerson: 'Fatima Khan', phone: '+91 00000 10003', email: 'desk@crescent.example', address: '7 Market Road, Hyderabad' },
      { name: 'Northstar Wholesale Pharma', contactPerson: 'Daniel Fernandes', phone: '+91 00000 10004', email: 'hello@northstar.example', address: '90 Depot Lane, Goa' },
    ].map((data) => prisma.supplier.create({ data })),
  );

  const medicines = [
    { name: 'Fevra-500', genericName: 'Paracetamol', sku: 'MED-001', category: 'Analgesics', unit: 'strip', reorderLevel: 50, taxRate: '5.00', defaultSalePrice: '25.00' },
    { name: 'Painex Gel', genericName: 'Diclofenac', sku: 'MED-002', category: 'Analgesics', unit: 'tube', reorderLevel: 20, taxRate: '12.00', defaultSalePrice: '145.00' },
    { name: 'Amoxivan-250', genericName: 'Amoxicillin', sku: 'MED-003', category: 'Antibiotics', unit: 'strip', reorderLevel: 40, taxRate: '12.00', defaultSalePrice: '85.00' },
    { name: 'Azithrovin-500', genericName: 'Azithromycin', sku: 'MED-004', category: 'Antibiotics', unit: 'strip', reorderLevel: 30, taxRate: '12.00', defaultSalePrice: '120.00' },
    { name: 'Cetzine-10', genericName: 'Cetirizine', sku: 'MED-005', category: 'Antihistamines', unit: 'strip', reorderLevel: 30, taxRate: '5.00', defaultSalePrice: '35.00' },
    { name: 'Allerfree Syrup', genericName: 'Chlorpheniramine', sku: 'MED-006', category: 'Antihistamines', unit: 'bottle', reorderLevel: 15, taxRate: '5.00', defaultSalePrice: '95.00' },
    { name: 'Vitacom-C', genericName: 'Multivitamin', sku: 'MED-007', category: 'Vitamins', unit: 'bottle', reorderLevel: 15, taxRate: '5.00', defaultSalePrice: '210.00' },
    { name: 'D3 Rise', genericName: 'Cholecalciferol', sku: 'MED-008', category: 'Vitamins', unit: 'strip', reorderLevel: 20, taxRate: '5.00', defaultSalePrice: '165.00' },
    { name: 'Acidstop-20', genericName: 'Pantoprazole', sku: 'MED-009', category: 'Gastro', unit: 'strip', reorderLevel: 35, taxRate: '12.00', defaultSalePrice: '78.00' },
    { name: 'Digestaid Syrup', genericName: 'Antacid', sku: 'MED-010', category: 'Gastro', unit: 'bottle', reorderLevel: 15, taxRate: '5.00', defaultSalePrice: '110.00' },
    { name: 'Glucobal-500', genericName: 'Metformin', sku: 'MED-011', category: 'Diabetes', unit: 'strip', reorderLevel: 40, taxRate: '5.00', defaultSalePrice: '65.00' },
    { name: 'Glycibal-2', genericName: 'Glimepiride', sku: 'MED-012', category: 'Diabetes', unit: 'strip', reorderLevel: 25, taxRate: '5.00', defaultSalePrice: '95.00' },
    { name: 'Fezol-100', genericName: 'Ferrous Ascorbate', sku: 'MED-013', category: 'Vitamins', unit: 'strip', reorderLevel: 30, taxRate: '5.00', defaultSalePrice: '88.00' },
    { name: 'Nasoclear Drops', genericName: 'Xylometazoline', sku: 'MED-014', category: 'Respiratory', unit: 'bottle', reorderLevel: 20, taxRate: '5.00', defaultSalePrice: '60.00' },
    { name: 'Cofrelief Syrup', genericName: 'Dextromethorphan', sku: 'MED-015', category: 'Respiratory', unit: 'bottle', reorderLevel: 18, taxRate: '5.00', defaultSalePrice: '105.00' },
  ];

  const medicineIdBySku = new Map<string, number>();
  for (const medicine of medicines) {
    const created = await prisma.medicine.create({
      data: {
        name: medicine.name,
        genericName: medicine.genericName,
        sku: medicine.sku,
        categoryId: categoryId.get(medicine.category) ?? 0,
        unit: medicine.unit,
        reorderLevel: medicine.reorderLevel,
        taxRate: money(medicine.taxRate),
        defaultSalePrice: money(medicine.defaultSalePrice),
      },
    });
    medicineIdBySku.set(medicine.sku, created.id);
  }

  const batches = [
    // sku, batchNo, quantity, purchasePrice, salePrice, expiryDays, supplier index
    ['MED-001', 'FEV-2601', 40, '16.50', '25.00', 20, 0],
    ['MED-001', 'FEV-2602', 100, '16.50', '25.00', 400, 1],
    ['MED-002', 'PNG-2601', 25, '98.00', '145.00', 540, 2],
    ['MED-003', 'AMX-2601', 60, '58.00', '85.00', 180, 0],
    ['MED-003', 'AMX-2602', 40, '58.00', '85.00', 300, 3],
    ['MED-004', 'AZI-2601', 18, '84.00', '120.00', 240, 1],
    ['MED-005', 'CTZ-2512', 30, '22.00', '35.00', -20, 2],
    ['MED-006', 'ALF-2601', 12, '62.00', '95.00', 90, 3],
    ['MED-007', 'VTC-2601', 20, '150.00', '210.00', 365, 0],
    ['MED-008', 'D3R-2601', 8, '110.00', '165.00', 200, 1],
    ['MED-009', 'ACP-2601', 50, '52.00', '78.00', 150, 2],
    ['MED-010', 'DGS-2601', 10, '72.00', '110.00', 120, 3],
    ['MED-011', 'GLB-2601', 35, '42.00', '65.00', 270, 0],
    ['MED-012', 'GCB-2601', 10, '66.00', '95.00', 60, 1],
    ['MED-013', 'FEZ-2601', 22, '58.00', '88.00', 330, 2],
    ['MED-014', 'NSD-2601', 14, '38.00', '60.00', 75, 3],
    ['MED-015', 'CFR-2601', 9, '70.00', '105.00', 45, 0],
    ['MED-015', 'CFR-2602', 30, '70.00', '105.00', 500, 0],
  ] as const;

  let batchCount = 0;
  let openingUnits = 0;

  for (const [sku, batchNo, quantity, purchasePrice, salePrice, expiryDays, supplierIndex] of batches) {
    const medicineId = medicineIdBySku.get(sku);
    const supplier = suppliers[supplierIndex];
    if (!medicineId || !supplier) {
      throw new Error(`Seed data error for ${sku}/${batchNo}`);
    }

    const batch = await prisma.batch.create({
      data: {
        medicineId,
        batchNo,
        expiryDate: inDays(expiryDays),
        quantityOnHand: quantity,
        purchasePrice: money(purchasePrice),
        salePrice: money(salePrice),
        supplierId: supplier.id,
      },
    });

    // Opening stock: one ledger row per batch, matching its quantity exactly.
    await prisma.stockMovement.create({
      data: {
        batchId: batch.id,
        type: 'OPENING',
        qtyDelta: quantity,
        referenceType: 'OPENING',
        reason: 'Opening stock (seed)',
        createdById: admin.id,
      },
    });

    batchCount += 1;
    openingUnits += quantity;
  }

  await prisma.setting.createMany({
    data: [
      { key: 'defaultTaxRate', value: '5' },
      { key: 'nearExpiryDays', value: '60' },
    ],
  });

  console.log(
    [
      'Seed complete.',
      `  users:      3 (admin@pharmacy.test / pharmacist@pharmacy.test / inventory@pharmacy.test, password ${DEMO_PASSWORD})`,
      `  catalogue:  ${categories.length} categories, ${suppliers.length} suppliers, ${medicines.length} medicines`,
      `  batches:    ${batchCount} (${openingUnits} units of opening stock, ledger rows match)`,
      '  settings:   defaultTaxRate=5, nearExpiryDays=60',
    ].join('\n'),
  );
}

// Execute when run directly (`npm run db:seed`), but stay importable from tests.
const entryPoint = process.argv[1];
const isDirectRun = entryPoint !== undefined && pathToFileURL(entryPoint).href === import.meta.url;

if (isDirectRun) {
  seedDatabase()
    .catch((error: unknown) => {
      console.error('Seed failed:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}
