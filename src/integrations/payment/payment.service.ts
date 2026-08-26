import {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookVerificationResult,
  PaymentStatus,
} from './payment.types';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';

export class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();
  private defaultProvider: string;

  constructor(defaultProvider: string) {
    this.defaultProvider = defaultProvider;
  }

  registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.name, provider);
    logger.info({ provider: provider.name }, 'Payment provider registered');
  }

  getProvider(name?: string): PaymentProvider {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Payment provider "${providerName}" not found`);
    }

    if (!provider.isConfigured()) {
      throw new Error(`Payment provider "${providerName}" is not configured`);
    }

    return provider;
  }

  async createPayment(request: CreatePaymentRequest, providerName?: string): Promise<CreatePaymentResponse> {
    const provider = this.getProvider(providerName);

    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId: request.orderId,
        status: { in: ['PENDING', 'PAID'] },
      },
    });

    if (existingPayment) {
      throw new Error(`Order ${request.orderId} already has an active payment`);
    }

    const response = await provider.createPayment(request);

    await prisma.payment.create({
      data: {
        orderId: request.orderId,
        provider: provider.name,
        reference: response.reference,
        amount: response.amount,
        status: response.status,
        qrString: response.qrString || null,
        qrUrl: response.qrUrl || null,
        providerData: (response.providerData || undefined) as any,
        expiredAt: response.expiredAt || null,
      },
    });

    logger.info({
      orderId: request.orderId,
      reference: response.reference,
      provider: provider.name,
      amount: response.amount,
    }, 'Payment created');

    return response;
  }

  async handleWebhook(body: unknown, headers: Record<string, string>, providerName?: string): Promise<boolean> {
    const provider = this.getProvider(providerName);

    const verification = provider.verifyWebhook(body, headers);

    if (!verification.valid || !verification.reference) {
      logger.warn({ provider: provider.name }, 'Webhook verification failed');
      return false;
    }

    const payment = await prisma.payment.findUnique({
      where: { reference: verification.reference },
      include: { order: true },
    });

    if (!payment) {
      logger.warn({ reference: verification.reference }, 'Payment not found for webhook');
      return false;
    }

    if (payment.status === 'PAID') {
      logger.info({ reference: verification.reference }, 'Payment already processed (idempotent)');
      return true;
    }

    if (verification.amount && verification.amount !== payment.amount) {
      logger.error({
        reference: verification.reference,
        expected: payment.amount,
        received: verification.amount,
      }, 'Payment amount mismatch');
      return false;
    }

    const newStatus = verification.status || 'PAID';

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        paidAt: verification.paidAt || new Date(),
        providerData: (verification.providerData || undefined) as any,
      },
    });

    await prisma.webhookLog.create({
      data: {
        source: provider.name,
        paymentId: payment.id,
        event: 'payment.status_update',
        payload: body as object,
        headers: headers as object,
        processed: true,
      },
    });

    logger.info({
      reference: verification.reference,
      status: newStatus,
      orderId: payment.orderId,
    }, 'Payment status updated via webhook');

    return true;
  }

  async getPaymentStatus(reference: string, providerName?: string): Promise<PaymentStatusResponse> {
    const provider = this.getProvider(providerName);
    return provider.getPaymentStatus(reference);
  }

  mapProviderStatus(providerStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'pending': 'PENDING',
      'waiting': 'PENDING',
      'success': 'PAID',
      'paid': 'PAID',
      'settlement': 'PAID',
      'expired': 'EXPIRED',
      'failed': 'FAILED',
      'cancelled': 'CANCELLED',
      'refunded': 'REFUNDED',
      'deny': 'FAILED',
    };

    return statusMap[providerStatus.toLowerCase()] || 'PENDING';
  }
}
