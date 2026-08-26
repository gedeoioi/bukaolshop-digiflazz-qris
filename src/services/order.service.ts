import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { generateInvoice } from '../utils/helpers';

export async function createOrder(params: {
  storeId: string;
  customerName?: string;
  customerPhone?: string;
  customerNumber?: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  adminFee?: number;
  paymentFee?: number;
}) {
  const productTotal = params.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = productTotal + (params.adminFee || 0) + (params.paymentFee || 0);
  const invoice = generateInvoice();

  const order = await prisma.order.create({
    data: {
      storeId: params.storeId,
      invoice,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerNumber: params.customerNumber,
      productTotal,
      adminFee: params.adminFee || 0,
      paymentFee: params.paymentFee || 0,
      totalAmount,
      status: 'PENDING_PAYMENT',
      items: {
        create: params.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
        })),
      },
    },
    include: { items: true, store: true },
  });

  logger.info({
    event: 'ORDER_CREATED',
    orderId: order.id,
    invoice: order.invoice,
    total: order.totalAmount,
  }, 'Order created');

  return order;
}

export async function getOrderByInvoice(invoice: string) {
  return prisma.order.findUnique({
    where: { invoice },
    include: {
      items: { include: { product: true } },
      payment: true,
      transaction: true,
      store: true,
    },
  });
}

export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      payment: true,
      transaction: true,
      store: true,
    },
  });
}

export async function updateOrderStatus(orderId: string, status: string, notes?: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status, notes },
  });
}

export async function lockOrderForProcessing(orderId: string): Promise<boolean> {
  try {
    const result = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PAID',
      },
      data: { status: 'PROCESSING' },
    });
    return result.count > 0;
  } catch (err) {
    logger.error({ err, orderId }, 'Failed to lock order');
    return false;
  }
}
