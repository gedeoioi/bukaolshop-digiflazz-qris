import cron from 'node-cron';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { syncProducts } from '../services/product.service';
import { retryPendingTransactions } from '../services/transaction.service';
import { getDailyReport } from '../services/report.service';

let tasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  logger.info('Starting cron scheduler...');

  const productSync = cron.schedule('*/30 * * * *', async () => {
    try {
      logger.info('CRON: Starting product sync');
      await syncProducts();
    } catch (err) {
      logger.error({ err }, 'CRON: Product sync failed');
    }
  });
  tasks.push(productSync);

  const pendingCheck = cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('CRON: Checking pending transactions');
      await retryPendingTransactions();
    } catch (err) {
      logger.error({ err }, 'CRON: Pending transaction check failed');
    }
  });
  tasks.push(pendingCheck);

  const expiredCheck = cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const expiredPayments = await prisma.payment.updateMany({
        where: {
          status: 'PENDING',
          expiredAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      if (expiredPayments.count > 0) {
        for (const payment of await prisma.payment.findMany({
          where: { status: 'EXPIRED', order: { status: 'PENDING_PAYMENT' } },
          include: { order: true },
        })) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: { status: 'EXPIRED' },
          });
        }
        logger.info({ count: expiredPayments.count }, 'CRON: Expired payments processed');
      }
    } catch (err) {
      logger.error({ err }, 'CRON: Expired payment check failed');
    }
  });
  tasks.push(expiredCheck);

  const dailyReport = cron.schedule('0 22 * * *', async () => {
    try {
      const report = await getDailyReport();
      logger.info({ report }, 'CRON: Daily report generated');

      const { getBot } = await import('../telegram/bot');
      const bot = getBot();
      if (bot) {
        const { env } = await import('../config/env');
        const adminIds = env.TELEGRAM_ADMIN_IDS
          ? env.TELEGRAM_ADMIN_IDS.split(',').map((id) => id.trim()).filter(Boolean)
          : [];

        const { formatCurrency } = await import('../utils/helpers');
        const text =
          '📊 <b>LAPORAN HARI INI</b>\n\n' +
          `Order       : ${report.orders.total}\n` +
          `Paid        : ${report.orders.paid}\n` +
          `Success     : ${report.orders.success}\n` +
          `Failed      : ${report.orders.failed}\n` +
          `Pending     : ${report.orders.pending}\n\n` +
          `Omzet       : ${formatCurrency(report.revenue.omzet)}\n` +
          `Profit      : ${formatCurrency(report.revenue.profit)}`;

        for (const adminId of adminIds) {
          try {
            await bot.telegram.sendMessage(adminId, text, { parse_mode: 'HTML' });
          } catch (err) {
            logger.error({ err, adminId }, 'Failed to send daily report');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'CRON: Daily report failed');
    }
  });
  tasks.push(dailyReport);

  logger.info('Cron scheduler started with 4 tasks');
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
  logger.info('Cron scheduler stopped');
}
