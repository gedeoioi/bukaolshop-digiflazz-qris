import { prisma } from '../config/database';

export async function getDailyReport(date?: Date) {
  const target = date || new Date();
  const startOfDay = new Date(target);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(target);
  endOfDay.setHours(23, 59, 59, 999);

  const [orderStats, revenueStats] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{
      total: bigint;
      paid: bigint;
      success: bigint;
      failed: bigint;
      pending: bigint;
    }>>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) as pending
      FROM orders
      WHERE created_at >= ? AND created_at <= ?
    `, startOfDay, endOfDay),

    prisma.$queryRawUnsafe<Array<{
      omzet: bigint;
      profit: bigint;
    }>>(`
      SELECT
        COALESCE(SUM(o.total_amount), 0) as omzet,
        COALESCE(SUM(o.total_amount - t.buy_price), 0) as profit
      FROM orders o
      JOIN transactions t ON t.order_id = o.id
      WHERE o.status = 'SUCCESS'
        AND o.created_at >= ? AND o.created_at <= ?
    `, startOfDay, endOfDay),
  ]);

  const stats = orderStats[0] || { total: 0n, paid: 0n, success: 0n, failed: 0n, pending: 0n };
  const rev = revenueStats[0] || { omzet: 0n, profit: 0n };

  return {
    date: target.toISOString().slice(0, 10),
    orders: {
      total: Number(stats.total),
      paid: Number(stats.paid),
      success: Number(stats.success),
      failed: Number(stats.failed),
      pending: Number(stats.pending),
    },
    revenue: {
      omzet: Number(rev.omzet),
      profit: Number(rev.profit),
    },
  };
}

export async function getTransactionByInvoice(invoice: string) {
  return prisma.order.findUnique({
    where: { invoice },
    include: {
      items: { include: { product: true } },
      payment: true,
      transaction: true,
    },
  });
}
