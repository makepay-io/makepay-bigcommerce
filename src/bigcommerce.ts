import { jwtVerify } from 'jose';
import type { AppConfig, BigCommerceOrder, InstalledStore } from './types.js';

type OAuthResponse = {
  access_token: string;
  scope: string;
  context: string;
  user?: InstalledStore['user'];
};

type SignedPayload = {
  context?: string;
  sub?: string;
  user?: InstalledStore['user'];
  owner?: InstalledStore['user'];
};

function storeHashFromContext(context: string): string {
  const [, storeHash] = context.split('/');
  if (!storeHash) {
    throw new Error('BigCommerce context did not include a store hash.');
  }
  return storeHash;
}

function bigCommerceHeaders(store: InstalledStore): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Auth-Token': store.accessToken,
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);
  if (!response.ok) {
    throw new Error(`BigCommerce API ${response.status}: ${text || response.statusText}`);
  }
  return payload;
}

export async function exchangeOAuthCode(
  config: AppConfig,
  params: { code: string; scope: string; context: string },
): Promise<InstalledStore> {
  const response = await fetch('https://login.bigcommerce.com/oauth2/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.bigCommerceClientId,
      client_secret: config.bigCommerceClientSecret,
      redirect_uri: `${config.publicAppUrl}/auth`,
      grant_type: 'authorization_code',
      code: params.code,
      scope: params.scope,
      context: params.context,
    }),
  });

  const payload = await readResponse<OAuthResponse>(response);
  const storeHash = storeHashFromContext(payload.context);

  return {
    storeHash,
    accessToken: payload.access_token,
    scope: payload.scope,
    context: payload.context,
    user: payload.user,
    installedAt: new Date().toISOString(),
  };
}

export async function verifySignedPayloadJwt(
  token: string,
  secret: string,
): Promise<SignedPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as SignedPayload;
}

export async function getOrder(store: InstalledStore, orderId: number): Promise<BigCommerceOrder> {
  const response = await fetch(
    `https://api.bigcommerce.com/stores/${store.storeHash}/v2/orders/${orderId}`,
    {
      method: 'GET',
      headers: bigCommerceHeaders(store),
    },
  );

  return await readResponse<BigCommerceOrder>(response);
}

export async function updateOrder(
  store: InstalledStore,
  orderId: number,
  body: Record<string, unknown>,
): Promise<BigCommerceOrder> {
  const response = await fetch(
    `https://api.bigcommerce.com/stores/${store.storeHash}/v2/orders/${orderId}`,
    {
      method: 'PUT',
      headers: bigCommerceHeaders(store),
      body: JSON.stringify(body),
    },
  );

  return await readResponse<BigCommerceOrder>(response);
}

export async function registerOrderCreatedWebhook(
  store: InstalledStore,
  destination: string,
): Promise<void> {
  const response = await fetch(`https://api.bigcommerce.com/stores/${store.storeHash}/v3/hooks`, {
    method: 'POST',
    headers: bigCommerceHeaders(store),
    body: JSON.stringify({
      scope: 'store/order/created',
      destination,
      is_active: true,
    }),
  });

  if (response.status === 409) {
    return;
  }

  await readResponse<unknown>(response);
}

export function extractStoreHashFromSignedPayload(payload: SignedPayload): string {
  if (!payload.context) {
    throw new Error('Signed payload is missing BigCommerce context.');
  }
  return storeHashFromContext(payload.context);
}

export function extractStoreHashFromWebhook(body: Record<string, unknown>): string | undefined {
  if (typeof body.store_hash === 'string') {
    return body.store_hash;
  }
  if (typeof body.producer === 'string' && body.producer.startsWith('stores/')) {
    return body.producer.slice('stores/'.length);
  }
  return undefined;
}
