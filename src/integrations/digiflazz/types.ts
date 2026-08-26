export interface DigiflazzConfig {
  username: string;
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
}

export interface DigiflazzBalanceRequest {
  cmd: 'deposit';
  username: string;
  sign: string;
}

export interface DigiflazzBalanceResponse {
  data: {
    deposit: number;
  };
}

export interface DigiflazzPriceListRequest {
  cmd: 'prepaid' | 'pasca';
  username: string;
  sign: string;
  code?: string;
  category?: string;
  brand?: string;
  type?: string;
}

export interface DigiflazzProduct {
  product_name: string;
  category: string;
  brand: string;
  type: string;
  seller_name: string;
  price: number;
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  unlimited_stock: boolean;
  stock: number;
  multi: boolean;
  start_cut_off: string;
  end_cut_off: string;
  desc: string;
}

export interface DigiflazzPriceListResponse {
  data: DigiflazzProduct[];
}

export interface DigiflazzTransactionRequest {
  username: string;
  buyer_sku_code: string;
  customer_no: string;
  ref_id: string;
  sign: string;
  testing?: boolean;
  max_price?: number;
  cb_url?: string;
  allow_dot?: boolean;
}

export interface DigiflazzTransactionResponse {
  data: {
    ref_id: string;
    customer_no: string;
    buyer_sku_code: string;
    message: string;
    status: 'Sukses' | 'Pending' | 'Gagal';
    rc: string;
    sn: string;
    buyer_last_saldo: number;
    price: number;
    tele?: string;
    wa?: string;
  };
}

export interface DigiflazzWebhookPayload {
  data: {
    ref_id: string;
    customer_no: string;
    buyer_sku_code: string;
    message: string;
    status: string;
    rc: string;
    sn: string;
    buyer_last_saldo: number;
    price: number;
    selling_price?: number;
    customer_name?: string;
    admin?: number;
    periode?: string;
    desc?: unknown;
    tele?: string;
    wa?: string;
  };
}
