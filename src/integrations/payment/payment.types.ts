export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  callbackUrl?: string;
  expiredAt?: Date;
}

export interface CreatePaymentResponse {
  provider: string;
  reference: string;
  amount: number;
  status: PaymentStatus;
  qrString?: string;
  qrUrl?: string;
  expiredAt?: Date;
  providerData?: Record<string, unknown>;
}

export interface PaymentStatusResponse {
  provider: string;
  reference: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: Date;
  providerData?: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reference?: string;
  status?: PaymentStatus;
  amount?: number;
  paidAt?: Date;
  providerData?: Record<string, unknown>;
}

export interface PaymentProvider {
  name: string;
  isConfigured(): boolean;
  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  getPaymentStatus(reference: string): Promise<PaymentStatusResponse>;
  verifyWebhook(body: unknown, headers: Record<string, string>): WebhookVerificationResult;
  cancelPayment?(reference: string): Promise<boolean>;
}
