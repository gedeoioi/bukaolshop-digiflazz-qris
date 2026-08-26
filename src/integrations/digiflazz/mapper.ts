import { DigiflazzProduct, DigiflazzTransactionResponse, DigiflazzWebhookPayload } from './types';

export function mapDigiflazzStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'sukses': 'SUCCESS',
    'success': 'SUCCESS',
    'pending': 'PROCESSING',
    'gagal': 'FAILED',
    'failed': 'FAILED',
  };
  return statusMap[status.toLowerCase()] || 'PROCESSING';
}

export function mapDigiflazzProduct(product: DigiflazzProduct) {
  return {
    digiflazzSku: product.buyer_sku_code,
    name: product.product_name,
    category: product.category,
    brand: product.brand,
    supplierPrice: product.price,
    isActive: product.buyer_product_status && product.seller_product_status,
    stock: product.unlimited_stock ? -1 : product.stock,
  };
}

export function mapDigiflazzTransactionResponse(response: DigiflazzTransactionResponse) {
  return {
    refId: response.data.ref_id,
    customerNo: response.data.customer_no,
    sku: response.data.buyer_sku_code,
    message: response.data.message,
    status: mapDigiflazzStatus(response.data.status),
    rc: response.data.rc,
    serialNumber: response.data.sn || null,
    price: response.data.price,
    buyerLastSaldo: response.data.buyer_last_saldo,
  };
}

export function mapDigiflazzWebhookPayload(payload: DigiflazzWebhookPayload) {
  return {
    refId: payload.data.ref_id,
    customerNo: payload.data.customer_no,
    sku: payload.data.buyer_sku_code,
    message: payload.data.message,
    status: mapDigiflazzStatus(payload.data.status),
    rc: payload.data.rc,
    serialNumber: payload.data.sn || null,
    price: payload.data.price,
    sellingPrice: payload.data.selling_price,
  };
}
