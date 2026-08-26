import { logger } from '../utils/logger';
import { formatCurrency, maskPhone } from '../utils/helpers';

let botInstance: any = null;
let adminIds: string[] = [];

export function setTelegramBot(bot: any, admins: string[]) {
  botInstance = bot;
  adminIds = admins;
}

async function sendMessage(chatId: string, text: string): Promise<boolean> {
  if (!botInstance) {
    logger.warn({ channel: 'telegram' }, 'Telegram bot not initialized');
    return false;
  }

  try {
    await botInstance.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    return true;
  } catch (err) {
    logger.error({ err, chatId, channel: 'telegram' }, 'Failed to send Telegram message');
    return false;
  }
}

async function notifyAdmins(text: string): Promise<void> {
  for (const adminId of adminIds) {
    await sendMessage(adminId, text);
  }
}

export async function sendOrderNotification(params: {
  invoice: string;
  productName: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
}): Promise<void> {
  const text = [
    '🛒 <b>ORDER BARU</b>',
    '',
    `Invoice: <code>${params.invoice}</code>`,
    `Produk: ${params.productName}`,
    `Customer: ${maskPhone(params.customerPhone)}`,
    `Total: ${formatCurrency(params.totalAmount)}`,
    `Status: ${params.status}`,
  ].join('\n');

  await notifyAdmins(text);
  logger.info({ event: 'NOTIFICATION_SENT', type: 'order', invoice: params.invoice });
}

export async function sendPaymentSuccessNotification(params: {
  invoice: string;
  amount: number;
}): Promise<void> {
  const text = [
    '💰 <b>PEMBAYARAN BERHASIL</b>',
    '',
    `Invoice: <code>${params.invoice}</code>`,
    `Total: ${formatCurrency(params.amount)}`,
    'Status: PAID',
    '',
    'Memproses produk...',
  ].join('\n');

  await notifyAdmins(text);
  logger.info({ event: 'NOTIFICATION_SENT', type: 'payment', invoice: params.invoice });
}

export async function sendTransactionSuccess(invoice: string, productName: string): Promise<void> {
  const text = [
    '✅ <b>TRANSAKSI SUKSES</b>',
    '',
    `Invoice: <code>${invoice}</code>`,
    `Produk: ${productName}`,
    'Status: SUCCESS',
  ].join('\n');

  await notifyAdmins(text);
  logger.info({ event: 'NOTIFICATION_SENT', type: 'success', invoice });
}

export async function sendTransactionFailed(invoice: string, productName: string): Promise<void> {
  const text = [
    '❌ <b>TRANSAKSI GAGAL</b>',
    '',
    `Invoice: <code>${invoice}</code>`,
    `Produk: ${productName}`,
    'Status: FAILED',
    '',
    'Silakan cek transaksi.',
  ].join('\n');

  await notifyAdmins(text);
  logger.info({ event: 'NOTIFICATION_SENT', type: 'failed', invoice });
}
