// Step 122: AdStat TypeScript types and Firestore helpers

import type { Timestamp } from 'firebase-admin/firestore';

export interface AdStat {
  id: string;
  userId: string;
  networkId: string;
  date: string; // YYYY-MM-DD
  country: string | null;
  cost: number | null;
  revenue: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpm: number | null;
  rawResponse: Record<string, unknown>;
  syncedAt: Timestamp;
  createdAt: Timestamp;
}

// Omits server-set fields
export type AdStatUpsertPayload = Omit<AdStat, 'id' | 'createdAt' | 'userId'> & {
  cost?: number | null;
  revenue?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpm?: number | null;
};
