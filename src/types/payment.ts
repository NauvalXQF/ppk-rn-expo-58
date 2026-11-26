import type { FineRecord } from '@/types/fine';

export type PaymentStatus = 'pending' | 'success' | 'failed';
export type PaymentFine = FineRecord & { reconciliationRequired?: boolean };

export interface PaymentTransaction {
  orderId: string;
  fineId: string;
  uid: string;
  sessionId: string;
  sessionTopik: string;
  labNama: string;
  fineCreatedAt: string;
  grossAmount: number;
  status: PaymentStatus;
  paymentType: string | null;
  transactionTime: string | null;
  createdAt: string;
  settledAt: string | null;
  retryable?: boolean;
  reconciliationRequired?: boolean;
}

export interface SnapCreateResponse {
  orderId: string;
  snapToken: string;
  redirectUrl: string;
}
