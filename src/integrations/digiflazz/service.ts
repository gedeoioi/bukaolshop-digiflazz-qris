import { DigiflazzClient } from './client';
import { DigiflazzConfig, DigiflazzTransactionResponse, DigiflazzWebhookPayload } from './types';
import { mapDigiflazzTransactionResponse, mapDigiflazzWebhookPayload, mapDigiflazzProduct } from './mapper';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

let digiflazzClient: DigiflazzClient | null = null;

export function getDigiflazzClient(): DigiflazzClient {
  if (!digiflazzClient) {
    const config: DigiflazzConfig = {
      username: env.DIGIFLAZZ_USERNAME,
      apiKey: env.DIGIFLAZZ_API_KEY,
      baseUrl: env.DIGIFLAZZ_BASE_URL,
      webhookSecret: env.DIGIFLAZZ_WEBHOOK_SECRET,
    };
    digiflazzClient = new DigiflazzClient(config);
  }
  return digiflazzClient;
}

export async function checkDigiflazzBalance(): Promise<number> {
  const client = getDigiflazzClient();
  const response = (await client.checkBalance()) as { data: { deposit: number } };
  return response.data.deposit;
}

export async function syncDigiflazzProducts(): Promise<number> {
  const client = getDigiflazzClient();
  const response = (await client.getProducts('prepaid')) as { data: Array<Record<string, unknown>> };

  if (!response.data || !Array.isArray(response.data)) {
    logger.warn({ service: 'digiflazz' }, 'No products returned from Digiflazz');
    return 0;
  }

  const { prisma } = await import('../../config/database');
  let synced = 0;

  for (const item of response.data) {
    const product = mapDigiflazzProduct(item as unknown as import('./types').DigiflazzProduct);
    try {
      await prisma.product.upsert({
        where: { digiflazzSku: product.digiflazzSku },
        update: {
          name: product.name,
          category: product.category,
          brand: product.brand,
          supplierPrice: product.supplierPrice,
          isActive: product.isActive,
          lastSyncedAt: new Date(),
        },
        create: {
          sku: product.digiflazzSku,
          name: product.name,
          category: product.category,
          brand: product.brand,
          supplierPrice: product.supplierPrice,
          sellingPrice: product.supplierPrice,
          markup: 0,
          digiflazzSku: product.digiflazzSku,
          isActive: product.isActive,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    } catch (err) {
      logger.error({ err, sku: product.digiflazzSku, service: 'digiflazz' }, 'Failed to sync product');
    }
  }

  logger.info({ synced, total: response.data.length, service: 'digiflazz' }, 'Product sync completed');
  return synced;
}

export async function createDigiflazzTransaction(params: {
  sku: string;
  customerNumber: string;
  refId: string;
}): Promise<{
  status: string;
  message: string;
  serialNumber: string | null;
  price: number;
  rc: string;
}> {
  const client = getDigiflazzClient();

  logger.info({
    event: 'DIGIFLAZZ_REQUEST',
    refId: params.refId,
    sku: params.sku,
    customerNumber: params.customerNumber,
  }, 'Sending transaction to Digiflazz');

  const response = (await client.createTransaction({
    buyerSkuCode: params.sku,
    customerNo: params.customerNumber,
    refId: params.refId,
  })) as DigiflazzTransactionResponse;

  const mapped = mapDigiflazzTransactionResponse(response);

  logger.info({
    event: mapped.status === 'SUCCESS' ? 'DIGIFLAZZ_SUCCESS' : 'DIGIFLAZZ_FAILED',
    refId: params.refId,
    status: mapped.status,
    message: mapped.message,
  }, 'Digiflazz transaction response');

  return {
    status: mapped.status,
    message: mapped.message,
    serialNumber: mapped.serialNumber,
    price: mapped.price,
    rc: mapped.rc,
  };
}

export async function checkDigiflazzTransaction(params: {
  sku: string;
  customerNumber: string;
  refId: string;
}): Promise<{
  status: string;
  message: string;
  serialNumber: string | null;
  price: number;
}> {
  const client = getDigiflazzClient();

  const response = (await client.checkTransaction({
    buyerSkuCode: params.sku,
    customerNo: params.customerNumber,
    refId: params.refId,
  })) as DigiflazzTransactionResponse;

  const mapped = mapDigiflazzTransactionResponse(response);

  return {
    status: mapped.status,
    message: mapped.message,
    serialNumber: mapped.serialNumber,
    price: mapped.price,
  };
}

export function verifyDigiflazzWebhook(body: unknown, headers: Record<string, string>): {
  valid: boolean;
  data: ReturnType<typeof mapDigiflazzWebhookPayload> | null;
} {
  try {
    const secret = env.DIGIFLAZZ_WEBHOOK_SECRET;

    if (secret) {
      const signature = headers['x-hub-signature'];
      if (!signature) {
        logger.warn({ service: 'digiflazz' }, 'Webhook signature missing');
        return { valid: false, data: null };
      }

      const expectedSignature =
        'sha1=' +
        crypto
          .createHmac('sha1', secret)
          .update(JSON.stringify(body))
          .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn({ service: 'digiflazz' }, 'Webhook signature mismatch');
        return { valid: false, data: null };
      }
    }

    const payload = body as DigiflazzWebhookPayload;
    if (!payload.data || !payload.data.ref_id) {
      logger.warn({ service: 'digiflazz' }, 'Invalid webhook payload');
      return { valid: false, data: null };
    }

    return {
      valid: true,
      data: mapDigiflazzWebhookPayload(payload),
    };
  } catch (err) {
    logger.error({ err, service: 'digiflazz' }, 'Webhook verification error');
    return { valid: false, data: null };
  }
}
