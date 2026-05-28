# Security Policy

## Reporting

Report security issues to info@makepay.io.

## Secrets

- Store BigCommerce app secrets and MakePay partner keys in a secret manager.
- Never log BigCommerce access tokens, MakePay key secrets, signed payloads, or raw production webhook bodies.
- Rotate both BigCommerce and MakePay credentials if an app environment is exposed.

## Webhooks

Verify MakePay webhook signatures before changing BigCommerce orders. BigCommerce order webhooks should be accepted only for stores installed through the OAuth flow.
