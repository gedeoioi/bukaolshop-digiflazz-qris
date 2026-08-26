import { BukaOlshopOrder } from './types';

export function mapBukaOlshopOrderToLocal(order: BukaOlshopOrder) {
  return {
    externalId: order.order_id,
    invoice: order.invoice,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerNumber: order.customer_number || order.customer_phone,
    productSku: order.product_sku,
    productName: order.product_name,
    quantity: order.quantity,
    price: order.price,
    totalAmount: order.total_amount,
    status: mapBukaOlshopStatus(order.status),
  };
}

export function mapBukaOlshopStatus(externalStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'PENDING_PAYMENT',
    'waiting_payment': 'PENDING_PAYMENT',
    'paid': 'PAID',
    'processing': 'PROCESSING',
    'success': 'SUCCESS',
    'completed': 'SUCCESS',
    'failed': 'FAILED',
    'cancelled': 'CANCELLED',
    'refunded': 'REFUNDED',
  };

  return statusMap[externalStatus.toLowerCase()] || 'PENDING_PAYMENT';
}

export function mapLocalStatusToBukaOlshop(localStatus: string): string {
  const statusMap: Record<string, string> = {
    'PENDING_PAYMENT': 'pending',
    'PAID': 'paid',
    'PROCESSING': 'processing',
    'SUCCESS': 'success',
    'FAILED': 'failed',
    'CANCELLED': 'cancelled',
    'REFUNDED': 'refunded',
  };

  return statusMap[localStatus] || 'pending';
}
