import { BukaOlshopClient } from './client';
import { BukaOlshopConfig, BukaOlshopWebhookPayload } from './types';
import { mapBukaOlshopOrderToLocal, mapLocalStatusToBukaOlshop } from './mapper';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let bukaolshopClient: BukaOlshopClient | null = null;

export function getBukaOlshopClient(): BukaOlshopClient {
  if (!bukaolshopClient) {
    const config: BukaOlshopConfig = {
      apiUrl: env.BUKAOLSHOP_API_URL,
      apiKey: env.BUKAOLSHOP_API_KEY,
      webhookSecret: env.BUKAOLSHOP_WEBHOOK_SECRET,
    };
    bukaolshopClient = new BukaOlshopClient(config);
  }
  return bukaolshopClient;
}

export function parseBukaOlshopWebhook(body: unknown, headers: Record<string, string>): BukaOlshopWebhookPayload | null {
  try {
    const payload = body as BukaOlshopWebhookPayload;

    if (!payload.event || !payload.order) {
      logger.warn({ service: 'bukaolshop' }, 'Invalid webhook payload: missing event or order');
      return null;
    }

    return payload;
  } catch (err) {
    logger.error({ err, service: 'bukaolshop' }, 'Failed to parse webhook payload');
    return null;
  }
}

export function verifyBukaOlshopWebhook(_payload: unknown, _headers: Record<string, string>): boolean {
  // TODO: Implement actual signature verification based on BukaOlshop documentation
  // If BukaOlshop provides webhook signature verification, implement it here
  // For now, return true if webhook secret is not configured
  if (!env.BUKAOLSHOP_WEBHOOK_SECRET) {
    return true;
  }

  // TODO: Verify signature
  // const signature = _headers['x-signature'] || _headers['x-bukaolshop-signature'];
  // if (!signature) return false;
  // return crypto.timingSafeEqual(
  //   Buffer.from(expectedSignature),
  //   Buffer.from(signature),
  // );

  return true;
}

export async function notifyBukaOlshopStatus(orderId: string, status: string, message?: string): Promise<void> {
  const client = getBukaOlshopClient();

  if (!client.isConfigured()) {
    logger.warn({ service: 'bukaolshop' }, 'BukaOlshop not configured, skipping status update');
    return;
  }

  try {
    const bukaolshopStatus = mapLocalStatusToBukaOlshop(status);
    await client.updateOrderStatus(orderId, bukaolshopStatus, message);
    logger.info({ orderId, status: bukaolshopStatus, service: 'bukaolshop' }, 'Order status updated on BukaOlshop');
  } catch (err) {
    logger.error({ err, orderId, status, service: 'bukaolshop' }, 'Failed to update order status on BukaOlshop');
  }
}
