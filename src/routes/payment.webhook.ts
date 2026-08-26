import { Router, Request, Response } from 'express';
import { PaymentService } from '../integrations/payment/payment.service';
import { QrisPaymentProvider } from '../integrations/payment/providers/qris/service';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const router = Router();

function getPaymentService(): PaymentService {
  const service = new PaymentService(env.PAYMENT_PROVIDER || 'qris');
  service.registerProvider(new QrisPaymentProvider());
  return service;
}

router.post('/payment', async (req: Request, res: Response) => {
  try {
    const paymentService = getPaymentService();
    const headers = req.headers as Record<string, string>;

    const webhookLog = await prisma.webhookLog.create({
      data: {
        source: 'payment',
        event: 'payment.webhook',
        payload: req.body,
        headers: headers as object,
        signature: headers['x-signature'] || headers['x-callback-signature'] || null,
      },
    });

    const processed = await paymentService.handleWebhook(req.body, headers);

    if (!processed) {
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { processed: false },
      });
      return res.status(400).json({ success: false, message: 'Webhook processing failed' });
    }

    await prisma.webhookLog.update({
      where: { id: webhookLog.id },
      data: { processed: true },
    });

    const payload = req.body as Record<string, unknown>;
    const reference = (payload.reference ||
      payload.order_id ||
      payload.merchant_ref ||
      payload.id) as string;

    if (reference) {
      const payment = await prisma.payment.findUnique({
        where: { reference },
        include: { order: true },
      });

      if (payment && payment.status === 'PAID' && payment.order.status === 'PENDING_PAYMENT') {
        await prisma.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' },
        });

        logger.info({
          event: 'PAYMENT_PAID',
          orderId: payment.orderId,
          reference,
        }, 'Payment confirmed, order marked as PAID');
      }
    }

    return res.json({ success: true, message: 'Webhook processed' });
  } catch (err) {
    logger.error({ err, source: 'payment' }, 'Payment webhook error');
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

export default router;
