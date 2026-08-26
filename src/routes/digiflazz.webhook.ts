import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { verifyDigiflazzWebhook } from '../integrations/digiflazz/service';
import { updateOrderStatus } from '../services/order.service';
import { notifyBukaOlshopStatus } from '../integrations/bukaolshop/service';
import { sendTransactionSuccess, sendTransactionFailed } from '../telegram/notifications';

const router = Router();

router.post('/digiflazz', async (req: Request, res: Response) => {
  try {
    const headers = req.headers as Record<string, string>;
    const event = headers['x-digiflazz-event'] || 'unknown';

    await prisma.webhookLog.create({
      data: {
        source: 'digiflazz',
        event,
        payload: req.body,
        headers: headers as object,
      },
    });

    const { valid, data } = verifyDigiflazzWebhook(req.body, headers);

    if (!valid || !data) {
      logger.warn({ source: 'digiflazz' }, 'Webhook verification failed');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        order: { invoice: data.refId },
      },
      include: { order: true },
    });

    if (!transaction) {
      logger.warn({ refId: data.refId, source: 'digiflazz' }, 'Transaction not found');
      return res.json({ success: true, message: 'Transaction not found' });
    }

    if (transaction.status === 'SUCCESS' || transaction.status === 'FAILED') {
      logger.info({ refId: data.refId, status: transaction.status }, 'Transaction already finalized');
      return res.json({ success: true, message: 'Already processed' });
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: data.status,
        serialNumber: data.serialNumber,
        message: data.message,
        providerData: req.body as any,
      },
    });

    if (data.status === 'SUCCESS') {
      await updateOrderStatus(transaction.orderId, 'SUCCESS');
      await notifyBukaOlshopStatus(transaction.orderId, 'SUCCESS');
      await sendTransactionSuccess(transaction.order.invoice, data.sku);
      logger.info({ event: 'DIGIFLAZZ_SUCCESS', refId: data.refId }, 'Transaction succeeded via webhook');
    } else if (data.status === 'FAILED') {
      await updateOrderStatus(transaction.orderId, 'FAILED');
      await notifyBukaOlshopStatus(transaction.orderId, 'FAILED');
      await sendTransactionFailed(transaction.order.invoice, data.sku);
      logger.info({ event: 'DIGIFLAZZ_FAILED', refId: data.refId }, 'Transaction failed via webhook');
    }

    return res.json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    logger.error({ err, source: 'digiflazz' }, 'Digiflazz webhook error');
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

export default router;
