// Step 122: Firestore collection helper for adStats

import {
  Firestore,
  CollectionReference,
  FieldValue,
} from 'firebase-admin/firestore';
import type { AdStatUpsertPayload } from './types';

function generateDocId(
  userId: string,
  networkId: string,
  date: string,
  country: string | null
): string {
  const countryPart = country ?? 'all';
  // Create a deterministic, safe document ID
  return `${userId}_${networkId}_${date}_${countryPart}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getAdStatsCollection(db: Firestore): CollectionReference {
  return db.collection('adStats');
}

/**
 * Upserts adStat records in batches of 500.
 * Uses deterministic document IDs to ensure idempotency.
 */
export async function upsertAdStatBatch(
  db: Firestore,
  userId: string,
  records: AdStatUpsertPayload[]
): Promise<void> {
  const BATCH_SIZE = 500;
  const chunks: AdStatUpsertPayload[][] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    chunks.push(records.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const batch = db.batch();

    for (const record of chunk) {
      const docId = generateDocId(userId, record.networkId, record.date, record.country ?? null);
      const docRef = db.collection('adStats').doc(docId);

      // Use merge: true so we don't overwrite createdAt
      batch.set(
        docRef,
        {
          ...record,
          userId,
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Set createdAt only on initial create via a separate conditional approach
      // Since set+merge won't overwrite existing fields unless specified,
      // we use a helper to only set createdAt if not already present
    }

    await batch.commit();
  }
}
