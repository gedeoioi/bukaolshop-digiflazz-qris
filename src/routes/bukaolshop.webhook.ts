import { Router, Request, Response } from 'express';
import { parseBukaOlshopWebhook, verifyBukaOlshopWebhook } from '../integrations/bukaolshop/service';
import { mapBukaOlshopOrderToLocal } from '../integrations/bukaolshop/mapper';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { generateInvoice } from '../utils/helpers';

const router = Router();

router.post('/bukaolshop', async (req: Request, res: Response) => {
  try {
    const headers = req.headers as Record<string, string>;

    if (!verifyBukaOlshopWebhook(req.body, headers)) {
      logger.warn({ source: 'bukaolshop' }, 'Webhook verification failed');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = parseBukaOlshopWebhook(req.body, headers);
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    await prisma.webhookLog.create({
      data: {
        source: 'bukaolshop',
        event: payload.event,
        payload: req.body,
        headers: headers as object,
      },
    });

    const orderData = mapBukaOlshopOrderToLocal(payload.order);

    const existingOrder = await prisma.order.findUnique({
      where: { invoice: orderData.invoice },
    });

    if (existingOrder) {
      logger.info({ invoice: orderData.invoice }, 'Order already exists');
      return res.json({ success: true, message: 'Order already exists' });
    }

    let store = await prisma.store.findFirst({
      where: { isActive: true },
    });

    if (!store) {
      store = await prisma.store.create({
        data: {
          name: 'Default Store',
          isActive: true,
        },
      });
    }

    let product = await prisma.product.findUnique({
      where: { sku: orderData.productSku },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          sku: orderData.productSku,
          name: orderData.productName,
          supplierPrice: 0,
          sellingPrice: orderData.price,
          markup: 0,
          isActive: true,
        },
      });
    }

    const invoice = orderData.invoice || generateInvoice();

    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        invoice,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        customerNumber: orderData.customerNumber,
        productTotal: orderData.price * orderData.quantity,
        adminFee: 0,
        paymentFee: 0,
        totalAmount: orderData.totalAmount,
        status: 'PENDING_PAYMENT',
        items: {
          create: {
            productId: product.id,
            quantity: orderData.quantity,
            price: orderData.price,
            subtotal: orderData.price * orderData.quantity,
          },
        },
      },
      include: { items: true },
    });

    logger.info({
      event: 'ORDER_CREATED',
      orderId: order.id,
      invoice: order.invoice,
      total: order.totalAmount,
    }, 'New order created from BukaOlshop');

    return res.json({
      success: true,
      message: 'Order created',
      data: { orderId: order.id, invoice: order.invoice },
    });
  } catch (err) {
    logger.error({ err, source: 'bukaolshop' }, 'Webhook processing error');
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
});

export default router;
