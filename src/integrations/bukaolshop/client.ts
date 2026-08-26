import axios, { AxiosInstance } from 'axios';
import { BukaOlshopConfig } from './types';
import { logger } from '../../utils/logger';

export class BukaOlshopClient {
  private client: AxiosInstance;
  private config: BukaOlshopConfig;

  constructor(config: BukaOlshopConfig) {
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
          service: 'bukaolshop',
          url: error.config?.url,
        });
        throw error;
      },
    );
  }

  // TODO: Implement based on actual BukaOlshop API documentation
  // These endpoints are placeholders — replace with real API calls

  async getOrder(orderId: string): Promise<unknown> {
    // TODO: Replace with actual BukaOlshop endpoint
    // Example: GET /api/orders/{orderId}
    const response = await this.client.get(`/api/orders/${orderId}`);
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string, message?: string): Promise<unknown> {
    // TODO: Replace with actual BukaOlshop endpoint
    // Example: PUT /api/orders/{orderId}/status
    const response = await this.client.put(`/api/orders/${orderId}/status`, {
      status,
      message,
    });
    return response.data;
  }

  async getProducts(): Promise<unknown> {
    // TODO: Replace with actual BukaOlshop endpoint
    // Example: GET /api/products
    const response = await this.client.get('/api/products');
    return response.data;
  }

  isConfigured(): boolean {
    return !!(this.config.apiUrl && this.config.apiKey);
  }
}
