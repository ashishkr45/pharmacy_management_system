import { prisma } from '../db/prisma.js';
import { TRANSACTION_OPTIONS } from '../db/transaction-options.js';
import { AppError } from '../utils/app-error.js';
import { money } from '../utils/money.js';
import { logAudit } from './audit-service.js';

export interface SettingsView {
  defaultTaxRate: string;
  nearExpiryDays: number;
}

export interface UpdateSettingsInput {
  defaultTaxRate?: string | undefined;
  nearExpiryDays?: number | undefined;
}

const SETTING_KEYS = ['defaultTaxRate', 'nearExpiryDays'] as const;
const DEFAULT_TAX_RATE = '5.00';
const DEFAULT_NEAR_EXPIRY_DAYS = 60;

interface SettingRow {
  key: string;
  value: string;
}

function toSettingsView(rows: SettingRow[]): SettingsView {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const tax = byKey.get('defaultTaxRate');
  const near = byKey.get('nearExpiryDays');
  const parsedTax = tax === undefined ? Number.NaN : Number(tax);
  const parsedNear = near === undefined ? Number.NaN : Number(near);

  return {
    defaultTaxRate:
      Number.isFinite(parsedTax) && parsedTax >= 0 && parsedTax <= 100
        ? money(tax ?? 0).toFixed(2)
        : DEFAULT_TAX_RATE,
    nearExpiryDays: Number.isFinite(parsedNear)
      ? Math.trunc(parsedNear)
      : DEFAULT_NEAR_EXPIRY_DAYS,
  };
}

/** Admin settings, with safe defaults when a row is missing. */
export async function getSettings(): Promise<SettingsView> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
    select: { key: true, value: true },
  });
  return toSettingsView(rows);
}

/** Internal read for alerts/expiry: a bad stored value falls back, never crashes. */
export async function getNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
  const parsed = row === null ? Number.NaN : Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Upserts only the supplied keys and audits each change with its previous
 * value, so the audit log can explain a threshold change later.
 */
export async function updateSettings(
  input: UpdateSettingsInput,
  actorId: number,
): Promise<SettingsView> {
  const entries = [
    ...(input.defaultTaxRate !== undefined
      ? [['defaultTaxRate', input.defaultTaxRate] as const]
      : []),
    ...(input.nearExpiryDays !== undefined
      ? [['nearExpiryDays', String(input.nearExpiryDays)] as const]
      : []),
  ];

  if (entries.length === 0) {
    throw AppError.validation('Provide at least one setting', { settings: 'Required' });
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    const before = new Map(existing.map((row) => [row.key, row.value]));

    for (const [key, value] of entries) {
      await tx.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });

      await logAudit(
        {
          userId: actorId,
          action: 'UPDATE',
          entityType: 'SETTING',
          entityId: key,
          before: { key, value: before.get(key) ?? null },
          after: { key, value },
        },
        tx,
      );
    }

    const rows = await tx.setting.findMany({
      where: { key: { in: [...SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    return toSettingsView(rows);
  }, TRANSACTION_OPTIONS);
}
