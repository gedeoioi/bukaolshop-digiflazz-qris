import { QrisClient } from './client';
import { QrisProviderConfig } from './types';
import { mapQrisStatus, mapQrisResponse, mapQrisStatusResponse } from './mapper';
import {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookVerificationResult,
} from '../../payment.types';
import { env } from '../../../../config/env';
import { logger } from '../../../../utils/logger';
import crypto from 'crypto';

export class QrisPaymentProvider implements PaymentProvider {
  public readonly name = 'qris';
  private client: QrisClient;
  private config: QrisProviderConfig;

  constructor() {
    this.config = {
      apiUrl: env.PAYMENT_API_URL,
      apiKey: env.PAYMENT_API_KEY,
      merchantId: env.PAYMENT_MERCHANT_ID,
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
      callbackUrl: env.PAYMENT_CALLBACK_URL,
    };
    this.client = new QrisClient(this.config);
  }

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const expiredAt = request.expiredAt || new Date(Date.now() + 30 * 60 * 1000);

    const response = await this.client.createQris({
      orderId: request.orderId,
      amount: request.amount,
      description: request.description,
      callbackUrl: request.callbackUrl || this.config.callbackUrl,
      expiredAt,
    });

    const mapped = mapQrisResponse(response as Record<string, unknown>);

    return {
      provider: this.name,
      reference: mapped.reference,
      amount: mapped.amount,
      status: 'PENDING',
      qrString: mapped.qrString,
      qrUrl: mapped.qrUrl,
      expiredAt: mapped.expiredAt,
      providerData: response as Record<string, unknown>,
    };
  }

  async getPaymentStatus(reference: string): Promise<PaymentStatusResponse> {
    const response = await this.client.getStatus(reference);
    const mapped = mapQrisStatusResponse(response as Record<string, unknown>);

    return {
      provider: this.name,
      reference: mapped.reference,
      amount: mapped.amount,
      status: mapQrisStatus(mapped.status),
      paidAt: mapped.paidAt,
      providerData: response as Record<string, unknown>,
    };
  }

  verifyWebhook(body: unknown, headers: Record<string, string>): WebhookVerificationResult {
    try {
      const payload = body as Record<string, unknown>;

      // TODO: Implement actual signature verification based on QRIS provider
      // Different providers use different signature schemes:
      //
      // Midtrans:
      //   SHA512(order_id + status_code + gross_amount + server_key)
      //   Header: no specific header, signature in body
      //
      // Tripay:
      //   HMAC-SHA256(json_body, private_key)
      //   Header: X-Callback-Signature
      //
      // Duitku:
      //   MD5(merchantCode + amount + merchantOrderId + apiKey)
      //   Header: signature in body

      if (this.config.webhookSecret) {
        const signature =
          headers['x-callback-signature'] ||
          headers['x-signature'] ||
          headers['x-webhook-signature'] ||
          (payload.signature as string);

        if (!signature) {
          logger.warn({ service: 'qris' }, 'Webhook signature missing');
          return { valid: false };
        }

        // TODO: Replace with actual signature verification
        // const expectedSignature = crypto
        //   .createHmac('sha256', this.config.webhookSecret)
        //   .update(JSON.stringify(body))
        //   .digest('hex');
        //
        // if (!crypto.timingSafeEqual(
        //   Buffer.from(signature),
        //   Buffer.from(expectedSignature),
        // )) {
        //   return { valid: false };
        // }
      }

      const reference = (payload.reference ||
        payload.order_id ||
        payload.merchant_ref ||
        payload.id) as string;

      const status = (payload.status ||
        payload.transaction_status ||
        'paid') as string;

      const amount = Number(
        payload.amount || payload.gross_amount || payload.total_amount || 0,
      );

      const paidAt = payload.paid_at
        ? new Date(payload.paid_at as string)
        : status.toLowerCase() === 'paid' || status.toLowerCase() === 'success'
          ? new Date()
          : undefined;

      return {
        valid: true,
        reference,
        status: mapQrisStatus(status),
        amount,
        paidAt,
        providerData: payload,
      };
    } catch (err) {
      logger.error({ err, service: 'qris' }, 'Webhook verification error');
      return { valid: false };
    }
  }
}
