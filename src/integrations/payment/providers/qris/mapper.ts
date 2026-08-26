import { PaymentStatus } from '../../payment.types';

export function mapQrisStatus(providerStatus: string): PaymentStatus {
  const statusMap: Record<string, PaymentStatus> = {
    'pending': 'PENDING',
    'waiting': 'PENDING',
    'active': 'PENDING',
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

export function mapQrisResponse(data: Record<string, unknown>): {
  reference: string;
  qrString: string;
  qrUrl?: string;
  amount: number;
  expiredAt: Date;
} {
  // TODO: Map based on actual QRIS provider response format
  // This is a generic mapper — adjust field names per provider

  return {
    reference: (data.reference || data.id || data.order_id || '') as string,
    qrString: (data.qr_string || data.qr_code || data.qris_string || '') as string,
    qrUrl: (data.qr_url || data.qris_url) as string | undefined,
    amount: (data.amount || data.gross_amount || 0) as number,
    expiredAt: data.expired_at
      ? new Date(data.expired_at as string)
      : new Date(Date.now() + 30 * 60 * 1000), // Default 30 minutes
  };
}

export function mapQrisStatusResponse(data: Record<string, unknown>): {
  reference: string;
  status: string;
  amount: number;
  paidAt?: Date;
} {
  // TODO: Map based on actual QRIS provider response format

  return {
    reference: (data.reference || data.id || data.order_id || '') as string,
    status: (data.status || 'pending') as string,
    amount: (data.amount || data.gross_amount || 0) as number,
    paidAt: data.paid_at ? new Date(data.paid_at as string) : undefined,
  };
}
