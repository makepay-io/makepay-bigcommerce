import { getOrder, updateOrder } from './bigcommerce.js';
import { createPaymentLinkForOrder } from './makepay.js';
import type { AppConfig, InstalledStore, PaymentMapping } from './types.js';
import type { StoreRepository } from './storage.js';

export async function createLinkForOrder(
  config: AppConfig,
  repository: StoreRepository,
  store: InstalledStore,
  orderId: number,
): Promise<PaymentMapping> {
  const existing = await repository.findPaymentByOrder(store.storeHash, orderId);
  if (existing) {
    return existing;
  }

  const order = await getOrder(store, orderId);
  const paymentLink = await createPaymentLinkForOrder(config, store.storeHash, order);
  const paymentLinkUid = paymentLink.uid ?? paymentLink.id;

  if (!paymentLinkUid) {
    throw new Error('MakePay did not return a payment link UID.');
  }

  const mapping: PaymentMapping = {
    storeHash: store.storeHash,
    orderId,
    paymentLinkUid,
    paymentUrl: paymentLink.publicUrl ?? paymentLink.checkoutUrl,
    status: 'created',
    createdAt: new Date().toISOString(),
  };

  await repository.savePayment(mapping);

  if (config.pendingStatusId) {
    await updateOrder(store, orderId, {
      status_id: config.pendingStatusId,
      staff_notes: `MakePay payment link: ${mapping.paymentUrl ?? paymentLinkUid}`,
    });
  }

  return mapping;
}

export async function markOrderPaid(
  config: AppConfig,
  repository: StoreRepository,
  paymentLinkUid: string,
): Promise<PaymentMapping | undefined> {
  const mapping = await repository.findPaymentByLink(paymentLinkUid);
  if (!mapping) {
    return undefined;
  }

  const store = await repository.getStore(mapping.storeHash);
  if (!store) {
    return undefined;
  }

  const paidMapping: PaymentMapping = {
    ...mapping,
    status: 'paid',
    paidAt: new Date().toISOString(),
  };

  await repository.savePayment(paidMapping);

  if (config.paidStatusId) {
    await updateOrder(store, mapping.orderId, {
      status_id: config.paidStatusId,
      staff_notes: `MakePay payment confirmed for link ${paymentLinkUid}`,
    });
  }

  return paidMapping;
}
