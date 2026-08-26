import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createDigiflazzTransaction, checkDigiflazzTransaction } from '../integrations/digiflazz/service';
import { lockOrderForProcessing, updateOrderStatus } from './order.service';
import { notifyBukaOlshopStatus } from '../integrations/bukaolshop/service';
import { sendTransactionSuccess, sendTransactionFailed } from '../telegram/notifications';

export async function processTransaction(orderId: string): Promise<void> {
  const locked = await lockOrderForProcessing(orderId);
  if (!locked) {
    logger.warn({ orderId }, 'Order not in PAID state or already processing');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });

  if (!order || order.items.length === 0) {
    logger.error({ orderId }, 'Order not found or has no items');
    return;
  }

  const item = order.items[0];
  const product = item.product;

  if (!product.digiflazzSku) {
    logger.error({ orderId, productId: product.id }, 'Product has no Digiflazz SKU mapping');
    await updateOrderStatus(orderId, 'FAILED', 'Product not mapped to Digiflazz');
    return;
  }

  const transaction = await prisma.transaction.create({
    data: {
      orderId,
      provider: 'digiflazz',
      sku: product.digiflazzSku,
      customerNumber: order.customerNumber || '',
      buyPrice: product.supplierPrice,
      sellingPrice: product.sellingPrice,
      status: 'PROCESSING',
    },
  });

  try {
    const result = await createDigiflazzTransaction({
      sku: product.digiflazzSku,
      customerNumber: order.customerNumber || '',
      refId: order.invoice,
    });

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: result.status,
        serialNumber: result.serialNumber,
        message: result.message,
        providerData: { rc: result.rc, price: result.price } as any,
      },
    });

    if (result.status === 'SUCCESS') {
      await updateOrderStatus(orderId, 'SUCCESS');
      await notifyBukaOlshopStatus(orderId, 'SUCCESS');
      await sendTransactionSuccess(order.invoice, product.name);
      logger.info({ event: 'DIGIFLAZZ_SUCCESS', orderId, invoice: order.invoice }, 'Transaction succeeded');
    } else if (result.status === 'FAILED') {
      await updateOrderStatus(orderId, 'FAILED');
      await notifyBukaOlshopStatus(orderId, 'FAILED');
      await sendTransactionFailed(order.invoice, product.name);
      logger.warn({ event: 'DIGIFLAZZ_FAILED', orderId, invoice: order.invoice, message: result.message }, 'Transaction failed');
    } else {
      logger.info({ orderId, invoice: order.invoice, status: result.status }, 'Transaction pending');
    }
  } catch (err) {
    logger.error({ err, orderId }, 'Transaction processing error');
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED', message: 'Processing error' },
    });
    await updateOrderStatus(orderId, 'FAILED');
    await sendTransactionFailed(order.invoice, product.name);
  }
}

export async function retryPendingTransactions(): Promise<void> {
  const pending = await prisma.transaction.findMany({
    where: { status: 'PROCESSING' },
    include: { order: true },
    take: 10,
  });

  for (const trx of pending) {
    try {
      const result = await checkDigiflazzTransaction({
        sku: trx.sku,
        customerNumber: trx.customerNumber,
        refId: trx.order.invoice,
      });

      if (result.status !== 'PROCESSING') {
        await prisma.transaction.update({
          where: { id: trx.id },
          data: {
            status: result.status,
            serialNumber: result.serialNumber,
            message: result.message,
          },
        });

        if (result.status === 'SUCCESS') {
          await updateOrderStatus(trx.orderId, 'SUCCESS');
          await notifyBukaOlshopStatus(trx.orderId, 'SUCCESS');
        } else if (result.status === 'FAILED') {
          await updateOrderStatus(trx.orderId, 'FAILED');
          await notifyBukaOlshopStatus(trx.orderId, 'FAILED');
        }

        logger.info({ transactionId: trx.id, status: result.status }, 'Pending transaction resolved');
      }
    } catch (err) {
      logger.error({ err, transactionId: trx.id }, 'Failed to check pending transaction');
    }
  }
}
