import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { DigiflazzConfig } from './types';
import { logger } from '../../utils/logger';

export class DigiflazzClient {
  private client: AxiosInstance;
  private config: DigiflazzConfig;

  constructor(config: DigiflazzConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://api.digiflazz.com',
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({
          err: error,
          service: 'digiflazz',
          url: error.config?.url,
        });
        throw error;
      },
    );
  }

  private generateSign(refId: string): string {
    return crypto
      .createHash('md5')
      .update(this.config.username + this.config.apiKey + refId)
      .digest('hex');
  }

  async checkBalance(): Promise<unknown> {
    const sign = this.generateSign('depo');
    const response = await this.client.post('/v1/cek-saldo', {
      cmd: 'deposit',
      username: this.config.username,
      sign,
    });
    return response.data;
  }

  async getProducts(cmd: 'prepaid' | 'pasca' = 'prepaid', options?: {
    code?: string;
    category?: string;
    brand?: string;
    type?: string;
  }): Promise<unknown> {
    const sign = this.generateSign('pricelist');
    const response = await this.client.post('/v1/price-list', {
      cmd,
      username: this.config.username,
      sign,
      ...options,
    });
    return response.data;
  }

  async createTransaction(params: {
    buyerSkuCode: string;
    customerNo: string;
    refId: string;
    testing?: boolean;
    maxPrice?: number;
    callbackUrl?: string;
  }): Promise<unknown> {
    const sign = this.generateSign(params.refId);
    const response = await this.client.post('/v1/transaction', {
      username: this.config.username,
      buyer_sku_code: params.buyerSkuCode,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign,
      testing: params.testing || false,
      max_price: params.maxPrice,
      cb_url: params.callbackUrl,
    });
    return response.data;
  }

  async checkTransaction(params: {
    buyerSkuCode: string;
    customerNo: string;
    refId: string;
    commands?: string;
  }): Promise<unknown> {
    const sign = this.generateSign(params.refId);
    const body: Record<string, unknown> = {
      username: this.config.username,
      buyer_sku_code: params.buyerSkuCode,
      customer_no: params.customerNo,
      ref_id: params.refId,
      sign,
    };

    if (params.commands) {
      body.commands = params.commands;
    }

    const response = await this.client.post('/v1/transaction', body);
    return response.data;
  }

  isConfigured(): boolean {
    return !!(this.config.username && this.config.apiKey);
  }
}
