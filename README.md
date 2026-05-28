# MakePay BigCommerce App

BigCommerce OAuth app starter for creating MakePay payment links from BigCommerce orders and reconciling paid MakePay webhooks back to BigCommerce.

This starter targets the app/OAuth path first. A fully native BigCommerce payment method may require additional BigCommerce payment-partner approval, so this repo focuses on the viable payment-link flow merchants can test as a draft app.

## Features

- BigCommerce install, load, and uninstall callbacks
- BigCommerce OAuth token exchange
- Store credential abstraction with an in-memory implementation for local development
- Order-created webhook registration and handler
- MakePay payment-link creation from BigCommerce order totals
- MakePay webhook signature verification and paid-order reconciliation
- Optional BigCommerce order status updates after link creation and payment
- Admin endpoint for manually generating a payment link for an order

## Environment

Copy `.env.example` to `.env` and set:

- `BIGCOMMERCE_CLIENT_ID`
- `BIGCOMMERCE_CLIENT_SECRET`
- `BIGCOMMERCE_JWT_SECRET`
- `PUBLIC_APP_URL`
- `MAKEPAY_KEY_ID`
- `MAKEPAY_KEY_SECRET`
- `MAKEPAY_WEBHOOK_SECRET`
- `ADMIN_TOKEN`

Optional status IDs:

- `BIGCOMMERCE_PENDING_STATUS_ID`
- `BIGCOMMERCE_PAID_STATUS_ID`

Leave status IDs empty if you only want the app to store payment-link mappings and avoid changing order statuses.

## Development

```sh
npm ci
npm run validate
npm run dev
```

Register these callback URLs in a BigCommerce draft app:

- Auth callback: `https://your-app.example/auth`
- Load callback: `https://your-app.example/load`
- Uninstall callback: `https://your-app.example/uninstall`

Configure MakePay webhooks to send signed events to:

```text
https://your-app.example/webhooks/makepay
```

## Storage

The included in-memory store is for local development and tests only. Replace `MemoryStoreRepository` with a database-backed implementation before production.
