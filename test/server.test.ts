import { createHmac } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server.js';
import { MemoryStoreRepository } from '../src/storage.js';
import type { AppConfig, InstalledStore } from '../src/types.js';

const config: AppConfig = {
  port: 3000,
  publicAppUrl: 'https://app.example.com',
  bigCommerceClientId: 'bc_client',
  bigCommerceClientSecret: 'bc_secret',
  bigCommerceJwtSecret: 'jwt_secret',
  makePayBaseUrl: 'https://makepay.example.com',
  makePayKeyId: 'mk_test',
  makePayKeySecret: 'mksec_test',
  makePayWebhookSecret: 'webhook_secret',
  adminToken: 'test_admin_token_123',
  pendingStatusId: 7,
  paidStatusId: 11,
};

const store: InstalledStore = {
  storeHash: 'store_abc',
  accessToken: 'bc_access',
  scope: 'store_v2_orders',
  context: 'stores/store_abc',
  installedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makePaySignature(rawBody: string): string {
  const timestamp = '1779997509';
  const digest = createHmac('sha256', config.makePayWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BigCommerce app server', () => {
  it('creates a payment link for an installed store order and reconciles paid webhooks', async () => {
    const repository = new MemoryStoreRepository();
    await repository.saveStore(store);

    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.endsWith('/v2/orders/100') && init?.method === 'GET') {
        return jsonResponse({
          id: 100,
          total_inc_tax: '129.99',
          currency_code: 'USDT',
          billing_address: {
            first_name: 'Example',
            last_name: 'Buyer',
            email: 'buyer@example.com',
          },
        });
      }
      if (requestUrl.endsWith('/api/partner/v1/makepay/payment-links')) {
        return jsonResponse({
          paymentLink: {
            uid: 'pay_100',
            publicUrl: 'https://makepay.io/payment/pay_100',
          },
        });
      }
      if (requestUrl.endsWith('/v2/orders/100') && init?.method === 'PUT') {
        return jsonResponse({ id: 100, status_id: 11 });
      }
      return jsonResponse({ message: 'not found' }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);

    const app = createApp(config, repository);

    await request(app)
      .post('/admin/orders/store_abc/100/payment-link')
      .set('authorization', `Bearer ${config.adminToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.paymentLinkUid).toBe('pay_100');
      });

    const rawBody = JSON.stringify({
      type: 'makepay.payment.status_changed',
      session: { status: 'paid' },
      paymentLink: { uid: 'pay_100' },
    });

    await request(app)
      .post('/webhooks/makepay')
      .set('content-type', 'application/json')
      .set('x-makepay-signature', makePaySignature(rawBody))
      .send(rawBody)
      .expect(200)
      .expect((response) => {
        expect(response.body.reconciled).toBe(true);
      });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v2/orders/100'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
