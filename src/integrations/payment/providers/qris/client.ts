import axios, { AxiosInstance } from 'axios';
import { QrisProviderConfig } from './types';
import { logger } from '../../../../utils/logger';

export class QrisClient {
  private client: AxiosInstance;
  private config: QrisProviderConfig;

  constructor(config: QrisProviderConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({
          err: error,
          service: 'qris',
          url: error.config?.url,
        });
        throw error;
      },
    );
  }

  // TODO: Implement based on actual QRIS provider API documentation
  // These methods are placeholders — replace with real API calls
  // Possible providers: Midtrans, Tripay, Duitku, OY!, etc.

  async createQris(request: {
    orderId: string;
    amount: number;
    description?: string;
    callbackUrl: string;
    expiredAt?: Date;
  }): Promise<unknown> {
    // TODO: Replace with actual QRIS provider endpoint
    // Example for Midtrans:
    // POST /v2/charge
    // { payment_type: "qris", transaction_details: { order_id, gross_amount } }

    // Example for Tripay:
    // POST /transaction/create
    // { method: "QRIS", merchant_ref, amount, callback_url, expired_time }

    const response = await this.client.post('/api/qris/create', {
      order_id: request.orderId,
      amount: request.amount,
      description: request.description,
      callback_url: request.callbackUrl,
      expired_time: request.expiredAt
        ? Math.floor(request.expiredAt.getTime() / 1000)
        : undefined,
    });

    return response.data;
  }

  async getStatus(reference: string): Promise<unknown> {
    // TODO: Replace with actual QRIS provider endpoint
    const response = await this.client.get(`/api/qris/status/${reference}`);
    return response.data;
  }

  isConfigured(): boolean {
    return !!(this.config.apiUrl && this.config.apiKey && this.config.merchantId);
  }
}
