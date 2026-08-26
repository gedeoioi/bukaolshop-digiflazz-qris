export interface BukaOlshopConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export interface BukaOlshopOrder {
  order_id: string;
  invoice: string;
  customer_name: string;
  customer_phone: string;
  customer_number?: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export interface BukaOlshopWebhookPayload {
  event: string;
  order: BukaOlshopOrder;
  timestamp: string;
  signature?: string;
}

export interface BukaOlshopStatusUpdate {
  order_id: string;
  status: string;
  message?: string;
  serial_number?: string;
}

export interface BukaOlshopApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
