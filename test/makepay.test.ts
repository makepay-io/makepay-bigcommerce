import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  extractPaymentLinkUid,
  isPaidMakePayEvent,
  verifyMakePaySignature,
} from '../src/makepay.js';

function sign(rawBody: string, secret: string, timestamp = '1779997509'): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

describe('MakePay webhook helpers', () => {
  it('verifies MakePay signatures', () => {
    const rawBody = JSON.stringify({ type: 'payment.paid' });
    const secret = 'test_secret';

    expect(verifyMakePaySignature(Buffer.from(rawBody), sign(rawBody, secret), secret)).toBe(true);
    expect(verifyMakePaySignature(Buffer.from(rawBody), sign(rawBody, 'wrong'), secret)).toBe(false);
  });

  it('detects paid events and extracts payment link UIDs', () => {
    const event = {
      type: 'makepay.payment.status_changed',
      event: { type: 'status_changed' },
      session: { status: 'paid' },
      paymentLink: { uid: 'pay_123' },
    };

    expect(extractPaymentLinkUid(event)).toBe('pay_123');
    expect(isPaidMakePayEvent(event)).toBe(true);
  });
});
