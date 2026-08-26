import { Telegraf, Context, Markup } from 'telegraf';
import { checkDigiflazzBalance } from '../integrations/digiflazz/service';
import { getOrderByInvoice } from '../services/order.service';
import { getDailyReport, getTransactionByInvoice } from '../services/report.service';
import { getProductBySku, syncProducts } from '../services/product.service';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';

export function registerCommands(bot: Telegraf): void {
  bot.start((ctx) => {
    ctx.reply(
      '🤖 <b>BukaOlshop Digiflazz Bot</b>\n\n' +
      'Selamat datang! Gunakan /menu untuk melihat menu.',
      { parse_mode: 'HTML' },
    );
  });

  bot.help((ctx) => {
    ctx.reply(
      '📋 <b>Daftar Command</b>\n\n' +
      '/menu - Menu utama\n' +
      '/saldo - Cek saldo Digiflazz\n' +
      '/order <invoice> - Cek order\n' +
      '/trx <invoice> - Cek transaksi\n' +
      '/produk <sku> - Cek produk\n' +
      '/today - Laporan hari ini\n' +
      '/sync - Sinkronisasi produk\n' +
      '/help - Bantuan',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('menu', (ctx) => {
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Dashboard', 'menu_dashboard'),
        Markup.button.callback('🛒 Transaksi', 'menu_transaksi'),
      ],
      [
        Markup.button.callback('💳 Pembayaran', 'menu_pembayaran'),
        Markup.button.callback('📦 Produk', 'menu_produk'),
      ],
      [
        Markup.button.callback('💰 Saldo Digiflazz', 'menu_saldo'),
        Markup.button.callback('📈 Laporan', 'menu_laporan'),
      ],
      [
        Markup.button.callback('⚙️ Settings', 'menu_settings'),
      ],
    ]);

    ctx.reply('🤖 <b>Menu Utama</b>\n\nPilih menu:', {
      parse_mode: 'HTML',
      ...keyboard,
    });
  });

  bot.command('saldo', async (ctx) => {
    try {
      const balance = await checkDigiflazzBalance();
      ctx.reply(
        '💰 <b>SALDO DIGIFLAZZ</b>\n\n' +
        `Saldo: <b>${formatCurrency(balance)}</b>\n` +
        'Status: CONNECTED',
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to check balance');
      ctx.reply('❌ Gagal mengecek saldo Digiflazz.');
    }
  });

  bot.command('order', async (ctx) => {
    const invoice = ctx.message.text.split(' ')[1];
    if (!invoice) {
      ctx.reply('Gunakan: /order <invoice>\nContoh: /order INV-20260826-0001');
      return;
    }

    try {
      const order = await getOrderByInvoice(invoice);
      if (!order) {
        ctx.reply(`❌ Order <code>${invoice}</code> tidak ditemukan.`, { parse_mode: 'HTML' });
        return;
      }

      const paymentStatus = order.payment?.status || '-';
      const trxStatus = order.transaction?.status || '-';

      ctx.reply(
        '🛒 <b>DETAIL ORDER</b>\n\n' +
        `Invoice: <code>${order.invoice}</code>\n` +
        `Customer: ${order.customerName || '-'}\n` +
        `Total: ${formatCurrency(order.totalAmount)}\n` +
        `Payment: ${paymentStatus}\n` +
        `Digiflazz: ${trxStatus}\n` +
        `Status: <b>${order.status}</b>`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to get order');
      ctx.reply('❌ Gagal mengambil data order.');
    }
  });

  bot.command('trx', async (ctx) => {
    const invoice = ctx.message.text.split(' ')[1];
    if (!invoice) {
      ctx.reply('Gunakan: /trx <invoice>\nContoh: /trx INV-20260826-0001');
      return;
    }

    try {
      const order = await getTransactionByInvoice(invoice);
      if (!order) {
        ctx.reply(`❌ Transaksi <code>${invoice}</code> tidak ditemukan.`, { parse_mode: 'HTML' });
        return;
      }

      const trx = order.transaction;
      const payment = order.payment;
      const product = order.items[0]?.product;

      ctx.reply(
        '🧾 <b>TRANSAKSI</b>\n\n' +
        `Invoice: <code>${order.invoice}</code>\n` +
        `Produk: ${product?.name || '-'}\n` +
        `Payment: ${payment?.status || '-'}\n` +
        `Digiflazz: ${trx?.status || '-'}\n` +
        `SN: <code>${trx?.serialNumber || '-'}</code>\n` +
        `Status: <b>${order.status}</b>`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to get transaction');
      ctx.reply('❌ Gagal mengambil data transaksi.');
    }
  });

  bot.command('produk', async (ctx) => {
    const sku = ctx.message.text.split(' ')[1];
    if (!sku) {
      ctx.reply('Gunakan: /produk <sku>\nContoh: /produk MLBB86');
      return;
    }

    try {
      const product = await getProductBySku(sku);
      if (!product) {
        ctx.reply(`❌ Produk <code>${sku}</code> tidak ditemukan.`, { parse_mode: 'HTML' });
        return;
      }

      ctx.reply(
        '📦 <b>PRODUK</b>\n\n' +
        `SKU: <code>${product.sku}</code>\n` +
        `Nama: ${product.name}\n` +
        `Kategori: ${product.category || '-'}\n` +
        `Brand: ${product.brand || '-'}\n` +
        `Harga Supplier: ${formatCurrency(product.supplierPrice)}\n` +
        `Harga Jual: ${formatCurrency(product.sellingPrice)}\n` +
        `Markup: ${formatCurrency(product.markup)}\n` +
        `Digiflazz SKU: <code>${product.digiflazzSku || '-'}</code>\n` +
        `Status: ${product.isActive ? '✅ Aktif' : '❌ Nonaktif'}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to get product');
      ctx.reply('❌ Gagal mengambil data produk.');
    }
  });

  bot.command('today', async (ctx) => {
    try {
      const report = await getDailyReport();

      ctx.reply(
        '📊 <b>LAPORAN HARI INI</b>\n\n' +
        `Order       : ${report.orders.total}\n` +
        `Paid        : ${report.orders.paid}\n` +
        `Success     : ${report.orders.success}\n` +
        `Failed      : ${report.orders.failed}\n` +
        `Pending     : ${report.orders.pending}\n\n` +
        `Omzet       : ${formatCurrency(report.revenue.omzet)}\n` +
        `Profit      : ${formatCurrency(report.revenue.profit)}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      logger.error({ err }, 'Failed to get report');
      ctx.reply('❌ Gagal mengambil laporan.');
    }
  });

  bot.command('sync', async (ctx) => {
    try {
      ctx.reply('🔄 Sinkronisasi produk dari Digiflazz...');
      const count = await syncProducts();
      ctx.reply(`✅ Sinkronisasi selesai. ${count} produk diperbarui.`);
    } catch (err) {
      logger.error({ err }, 'Failed to sync products');
      ctx.reply('❌ Gagal sinkronisasi produk.');
    }
  });

  bot.action('menu_dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const [balance, report] = await Promise.all([
        checkDigiflazzBalance(),
        getDailyReport(),
      ]);

      await ctx.editMessageText(
        '📊 <b>DASHBOARD</b>\n\n' +
        `💰 Saldo: ${formatCurrency(balance)}\n\n` +
        `📋 Order Hari Ini:\n` +
        `  Total: ${report.orders.total}\n` +
        `  Success: ${report.orders.success}\n` +
        `  Failed: ${report.orders.failed}\n` +
        `  Pending: ${report.orders.pending}\n\n` +
        `💵 Omzet: ${formatCurrency(report.revenue.omzet)}\n` +
        `📈 Profit: ${formatCurrency(report.revenue.profit)}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.editMessageText('❌ Gagal memuat dashboard.');
    }
  });

  bot.action('menu_saldo', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const balance = await checkDigiflazzBalance();
      await ctx.editMessageText(
        '💰 <b>SALDO DIGIFLAZZ</b>\n\n' +
        `Saldo: <b>${formatCurrency(balance)}</b>\n` +
        'Status: CONNECTED',
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.editMessageText('❌ Gagal mengecek saldo.');
    }
  });

  bot.action('menu_transaksi', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const report = await getDailyReport();
      await ctx.editMessageText(
        '🛒 <b>TRANSAKSI HARI INI</b>\n\n' +
        `Total: ${report.orders.total}\n` +
        `Success: ${report.orders.success}\n` +
        `Failed: ${report.orders.failed}\n` +
        `Pending: ${report.orders.pending}\n\n` +
        'Gunakan /trx <invoice> untuk detail.',
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.editMessageText('❌ Gagal memuat transaksi.');
    }
  });

  bot.action('menu_laporan', async (ctx) => {
    await ctx.answerCbQuery();
    try {
      const report = await getDailyReport();
      await ctx.editMessageText(
        '📈 <b>LAPORAN HARI INI</b>\n\n' +
        `Order: ${report.orders.total}\n` +
        `Paid: ${report.orders.paid}\n` +
        `Success: ${report.orders.success}\n` +
        `Failed: ${report.orders.failed}\n\n` +
        `Omzet: ${formatCurrency(report.revenue.omzet)}\n` +
        `Profit: ${formatCurrency(report.revenue.profit)}`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.editMessageText('❌ Gagal memuat laporan.');
    }
  });

  bot.action('menu_produk', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '📦 <b>PRODUK</b>\n\n' +
      'Gunakan /produk <sku> untuk cek produk.\n' +
      'Gunakan /sync untuk sinkronisasi dari Digiflazz.',
      { parse_mode: 'HTML' },
    );
  });

  bot.action('menu_pembayaran', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '💳 <b>PEMBAYARAN</b>\n\n' +
      'Gunakan /order <invoice> untuk cek status pembayaran.',
      { parse_mode: 'HTML' },
    );
  });

  bot.action('menu_settings', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '⚙️ <b>SETTINGS</b>\n\n' +
      'Konfigurasi melalui .env file.\n\n' +
      `BukaOlshop: ${process.env.BUKAOLSHOP_API_URL ? '✅' : '❌'}\n` +
      `Digiflazz: ${process.env.DIGIFLAZZ_USERNAME ? '✅' : '❌'}\n` +
      `Payment: ${process.env.PAYMENT_PROVIDER ? '✅' : '❌'}\n` +
      `Telegram: ✅`,
      { parse_mode: 'HTML' },
    );
  });
}
