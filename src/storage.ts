import type { InstalledStore, PaymentMapping } from './types.js';

export interface StoreRepository {
  saveStore(store: InstalledStore): Promise<void>;
  getStore(storeHash: string): Promise<InstalledStore | undefined>;
  deleteStore(storeHash: string): Promise<void>;
  savePayment(mapping: PaymentMapping): Promise<void>;
  findPaymentByOrder(storeHash: string, orderId: number): Promise<PaymentMapping | undefined>;
  findPaymentByLink(paymentLinkUid: string): Promise<PaymentMapping | undefined>;
}

export class MemoryStoreRepository implements StoreRepository {
  private readonly stores = new Map<string, InstalledStore>();

  private readonly paymentsByOrder = new Map<string, PaymentMapping>();

  private readonly paymentsByLink = new Map<string, PaymentMapping>();

  async saveStore(store: InstalledStore): Promise<void> {
    this.stores.set(store.storeHash, store);
  }

  async getStore(storeHash: string): Promise<InstalledStore | undefined> {
    return this.stores.get(storeHash);
  }

  async deleteStore(storeHash: string): Promise<void> {
    this.stores.delete(storeHash);
  }

  async savePayment(mapping: PaymentMapping): Promise<void> {
    this.paymentsByOrder.set(`${mapping.storeHash}:${mapping.orderId}`, mapping);
    this.paymentsByLink.set(mapping.paymentLinkUid, mapping);
  }

  async findPaymentByOrder(storeHash: string, orderId: number): Promise<PaymentMapping | undefined> {
    return this.paymentsByOrder.get(`${storeHash}:${orderId}`);
  }

  async findPaymentByLink(paymentLinkUid: string): Promise<PaymentMapping | undefined> {
    return this.paymentsByLink.get(paymentLinkUid);
  }
}
