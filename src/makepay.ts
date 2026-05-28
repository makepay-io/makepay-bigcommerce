import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  AppConfig,
  BigCommerceOrder,
  MakePayPaymentLink,
  MakePayWebhookEvent,
} from './types.js';

function amountForOrder(order: BigCommerceOrder): string {
  return order.total_inc_tax || order.total_ex_tax || '0';
}

function customerName(order: BigCommerceOrder): string | undefined {
  const firstName = order.billing_address?.first_name;
  const lastName = order.billing_address?.last_name;
  return [firstName, lastName].filter(Boolean).join(' ') || undefined;
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new Error(`MakePay API ${response.status}: ${text || response.statusText}`);
  }
  return payload;
}

export async function createPaymentLinkForOrder(
  config: AppConfig,
  storeHash: string,
  order: BigCommerceOrder,
): Promise<MakePayPaymentLink> {
  const response = await fetch(`${config.makePayBaseUrl}/api/partner/v1/makepay/payment-links`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-MakeCrypto-Key-Id': config.makePayKeyId,
      'X-MakeCrypto-Key-Secret': config.makePayKeySecret,
    },
    body: JSON.stringify({
      status: 'active',
      sendPaymentRequestEmail: true,
      payload: {
        title: `BigCommerce order #${order.id}`,
        description: `Payment for BigCommerce order #${order.id}`,
        amount: amountForOrder(order),
        currency: order.currency_code,
        orderId: String(order.id),
        merchantOrderId: `${storeHash}:${order.id}`,
        customerEmail: order.billing_address?.email,
        customerName: customerName(order),
        returnUrl: `https://store-${storeHash}.mybigcommerce.com/account.php?action=view_order&order_id=${order.id}`,
        successUrl: `https://store-${storeHash}.mybigcommerce.com/account.php?action=view_order&order_id=${order.id}`,
        metadata: {
          platform: 'bigcommerce',
          storeHash,
          orderId: order.id,
        },
      },
    }),
  });

  const payload = await readResponse<{ paymentLink?: MakePayPaymentLink } & MakePayPaymentLink>(
    response,
  );
  return payload.paymentLink ?? payload;
}

export function verifyMakePaySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.trim().split('=');
      return [key, value];
    }),
  );

  if (!parts.t || !parts.v1) {
    return false;
  }

  const signedPayload = `${parts.t}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(parts.v1, 'hex');

  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function extractPaymentLinkUid(event: MakePayWebhookEvent): string | undefined {
  if (event.paymentLink?.uid) {
    return event.paymentLink.uid;
  }
  if (event.paymentLink?.id) {
    return event.paymentLink.id;
  }
  const data = event.data ?? {};
  const candidate = data.paymentLinkUid ?? data.payment_link_uid ?? data.uid;
  return typeof candidate === 'string' ? candidate : undefined;
}

export function isPaidMakePayEvent(event: MakePayWebhookEvent): boolean {
  const values = [
    event.type,
    event.event?.type,
    event.session?.status,
    event.paymentLink?.status,
  ].filter(Boolean);

  return values.some((value) => {
    const normalized = String(value).toLowerCase();
    return normalized === 'paid' || normalized.includes('payment.paid');
  });
}
