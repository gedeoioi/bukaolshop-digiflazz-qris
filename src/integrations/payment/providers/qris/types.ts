export interface QrisProviderConfig {
  apiUrl: string;
  apiKey: string;
  merchantId: string;
  webhookSecret: string;
  callbackUrl: string;
}

export interface QrisCreateRequest {
  orderId: string;
  amount: number;
  description?: string;
  expiredAt?: Date;
}

export interface QrisCreateResponse {
  reference: string;
  qrString: string;
  qrUrl?: string;
  amount: number;
  expiredAt: Date;
}

export interface QrisStatusResponse {
  reference: string;
  status: string;
  amount: number;
  paidAt?: Date;
}

export interface QrisWebhookPayload {
  [key: string]: unknown;
}
