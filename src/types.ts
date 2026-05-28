export type AppConfig = {
  port: number;
  publicAppUrl: string;
  bigCommerceClientId: string;
  bigCommerceClientSecret: string;
  bigCommerceJwtSecret: string;
  makePayBaseUrl: string;
  makePayKeyId: string;
  makePayKeySecret: string;
  makePayWebhookSecret: string;
  adminToken: string;
  pendingStatusId?: number;
  paidStatusId?: number;
};

export type InstalledStore = {
  storeHash: string;
  accessToken: string;
  scope: string;
  context: string;
  user?: {
    id?: number;
    email?: string;
    username?: string;
  };
  installedAt: string;
};

export type BigCommerceOrder = {
  id: number;
  status_id?: number;
  custom_status?: string;
  total_inc_tax?: string;
  total_ex_tax?: string;
  currency_code?: string;
  date_created?: string;
  billing_address?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
};

export type PaymentMapping = {
  storeHash: string;
  orderId: number;
  paymentLinkUid: string;
  paymentUrl?: string;
  status: 'created' | 'paid';
  createdAt: string;
  paidAt?: string;
};

export type MakePayPaymentLink = {
  uid?: string;
  id?: string;
  publicUrl?: string;
  checkoutUrl?: string;
  status?: string;
};

export type MakePayWebhookEvent = {
  type?: string;
  paymentLink?: MakePayPaymentLink;
  session?: {
    status?: string;
  };
  event?: {
    type?: string;
  };
  data?: Record<string, unknown>;
};
