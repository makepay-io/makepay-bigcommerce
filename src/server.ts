import express, { type Request, type Response } from 'express';
import {
  exchangeOAuthCode,
  extractStoreHashFromSignedPayload,
  extractStoreHashFromWebhook,
  registerOrderCreatedWebhook,
  verifySignedPayloadJwt,
} from './bigcommerce.js';
import {
  extractPaymentLinkUid,
  isPaidMakePayEvent,
  verifyMakePaySignature,
} from './makepay.js';
import { createLinkForOrder, markOrderPaid } from './orderFlow.js';
import { MemoryStoreRepository, type StoreRepository } from './storage.js';
import type { AppConfig, MakePayWebhookEvent } from './types.js';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

function requireAdmin(config: AppConfig, request: Request, response: Response): boolean {
  const header = request.header('authorization');
  if (header !== `Bearer ${config.adminToken}`) {
    response.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function renderDashboard(storeHash: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>MakePay for BigCommerce</title>
  </head>
  <body>
    <h1>MakePay for BigCommerce</h1>
    <p>Store ${storeHash} is connected.</p>
  </body>
</html>`;
}

export function createApp(
  config: AppConfig,
  repository: StoreRepository = new MemoryStoreRepository(),
) {
  const app = express();

  app.use(
    express.json({
      verify: (request: RawBodyRequest, _response, buffer) => {
        request.rawBody = Buffer.from(buffer);
      },
    }),
  );

  app.get('/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.get('/auth', async (request, response, next) => {
    try {
      const code = String(request.query.code ?? '');
      const scope = String(request.query.scope ?? '');
      const context = String(request.query.context ?? '');

      if (!code || !scope || !context) {
        response.status(400).json({ error: 'Missing BigCommerce OAuth parameters.' });
        return;
      }

      const store = await exchangeOAuthCode(config, { code, scope, context });
      await repository.saveStore(store);
      await registerOrderCreatedWebhook(
        store,
        `${config.publicAppUrl}/webhooks/bigcommerce/orders`,
      );

      response.redirect(`/load?storeHash=${encodeURIComponent(store.storeHash)}`);
    } catch (error) {
      next(error);
    }
  });

  app.get('/load', async (request, response, next) => {
    try {
      const signedPayload = request.query.signed_payload_jwt;
      let storeHash = typeof request.query.storeHash === 'string' ? request.query.storeHash : '';

      if (typeof signedPayload === 'string') {
        const payload = await verifySignedPayloadJwt(signedPayload, config.bigCommerceJwtSecret);
        storeHash = extractStoreHashFromSignedPayload(payload);
      }

      if (!storeHash) {
        response.status(400).json({ error: 'Missing signed payload or store hash.' });
        return;
      }

      response.type('html').send(renderDashboard(storeHash));
    } catch (error) {
      next(error);
    }
  });

  app.get('/uninstall', async (request, response, next) => {
    try {
      const signedPayload = request.query.signed_payload_jwt;
      if (typeof signedPayload !== 'string') {
        response.status(400).json({ error: 'Missing signed payload.' });
        return;
      }

      const payload = await verifySignedPayloadJwt(signedPayload, config.bigCommerceJwtSecret);
      const storeHash = extractStoreHashFromSignedPayload(payload);
      await repository.deleteStore(storeHash);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/bigcommerce/orders', async (request, response, next) => {
    try {
      const storeHash = extractStoreHashFromWebhook(request.body);
      const orderId = Number(request.body?.data?.id);

      if (!storeHash || !Number.isFinite(orderId)) {
        response.status(400).json({ error: 'Invalid BigCommerce order webhook.' });
        return;
      }

      const store = await repository.getStore(storeHash);
      if (!store) {
        response.status(202).json({ ok: true, skipped: 'store_not_installed' });
        return;
      }

      const mapping = await createLinkForOrder(config, repository, store, orderId);
      response.status(202).json({ ok: true, paymentLinkUid: mapping.paymentLinkUid });
    } catch (error) {
      next(error);
    }
  });

  app.post('/webhooks/makepay', async (request: RawBodyRequest, response, next) => {
    try {
      const verified = verifyMakePaySignature(
        request.rawBody ?? Buffer.from(JSON.stringify(request.body)),
        request.header('x-makepay-signature'),
        config.makePayWebhookSecret,
      );

      if (!verified) {
        response.status(401).json({ error: 'Invalid MakePay signature.' });
        return;
      }

      const event = request.body as MakePayWebhookEvent;
      const paymentLinkUid = extractPaymentLinkUid(event);

      if (!paymentLinkUid || !isPaidMakePayEvent(event)) {
        response.status(202).json({ ok: true, ignored: true });
        return;
      }

      const mapping = await markOrderPaid(config, repository, paymentLinkUid);
      response.json({ ok: true, reconciled: Boolean(mapping) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/admin/orders/:storeHash/:orderId/payment-link', async (request, response, next) => {
    try {
      if (!requireAdmin(config, request, response)) {
        return;
      }

      const store = await repository.getStore(request.params.storeHash);
      if (!store) {
        response.status(404).json({ error: 'Store is not installed.' });
        return;
      }

      const orderId = Number(request.params.orderId);
      if (!Number.isFinite(orderId)) {
        response.status(400).json({ error: 'Invalid order ID.' });
        return;
      }

      const mapping = await createLinkForOrder(config, repository, store, orderId);
      response.json(mapping);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    response.status(500).json({ error: message });
  });

  return app;
}
