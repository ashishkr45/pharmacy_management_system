import { prisma } from '../db/prisma.js';
import { startOfToday, systemClock, type Clock } from '../utils/clock.js';
import { money } from '../utils/money.js';
import { getAlertCounts, type AlertCounts } from './alert-service.js';

export interface DashboardSummary {
  date: string;
  todaySales: {
    count: number;
    subtotal: string;
    taxTotal: string;
    total: string;
  };
  alerts: AlertCounts;
  recentSales: Array<{
    id: number;
    invoiceNo: string;
    customerName: string | null;
    total: string;
    status: string;
    createdAt: Date;
  }>;
  recentMovements: Array<{
    id: number;
    type: string;
    qtyDelta: number;
    createdAt: Date;
    batch: {
      id: number;
      batchNo: string;
      medicine: { id: number; name: string; sku: string };
    };
  }>;
}

/** One read-only summary for the landing page; all roles may see the figures. */
export async function getDashboardSummary(clock: Clock = systemClock): Promise<DashboardSummary> {
  const today = startOfToday(clock);
  const day = today.toISOString().slice(0, 10);
  const dayRange = {
    gte: today,
    lte: new Date(`${day}T23:59:59.999Z`),
  };

  const [aggregate, recentSales, recentMovements, alerts] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: dayRange },
      _count: { _all: true },
      _sum: { subtotal: true, taxTotal: true, total: true },
    }),
    prisma.sale.findMany({
      where: { createdAt: dayRange },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: {
        id: true,
        invoiceNo: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.stockMovement.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: {
        id: true,
        type: true,
        qtyDelta: true,
        createdAt: true,
        batch: {
          select: {
            id: true,
            batchNo: true,
            medicine: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    }),
    getAlertCounts(clock),
  ]);

  return {
    date: day,
    todaySales: {
      count: aggregate._count._all,
      subtotal: money(aggregate._sum.subtotal ?? 0).toFixed(2),
      taxTotal: money(aggregate._sum.taxTotal ?? 0).toFixed(2),
      total: money(aggregate._sum.total ?? 0).toFixed(2),
    },
    alerts,
    recentSales: recentSales.map((sale) => ({
      ...sale,
      total: money(sale.total).toFixed(2),
    })),
    recentMovements,
  };
}
