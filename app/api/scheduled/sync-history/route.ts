import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { isValidNetworkId } from '@/lib/constants';

const SYNC_ACTIONS = new Set(['sync_completed', 'sync_failed', 'sync_partial']);
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

function toIso(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function deriveStatus(action: string): 'success' | 'failed' | 'partial' {
  if (action === 'sync_completed') return 'success';
  if (action === 'sync_partial') return 'partial';
  return 'failed';
}

function deriveTriggeredBy(details: Record<string, unknown>): 'scheduler' | 'user' {
  const tb = details?.triggeredBy ?? details?.trigger;
  if (tb === 'user' || tb === 'manual') return 'user';
  return 'scheduler';
}

export interface SyncHistoryEntry {
  id: string;
  networkId: string;
  status: 'success' | 'failed' | 'partial';
  triggeredBy: 'scheduler' | 'user';
  triggeredAt: string;
  completedAt: string | null;
  rowsFetched: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const networkId = searchParams.get('networkId') || null;
  const cursor = searchParams.get('cursor') || null;
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  if (networkId && !isValidNetworkId(networkId)) {
    return NextResponse.json({ error: 'Invalid networkId' }, { status: 400 });
  }

  try {
    // Base query: uid-scoped, sync actions only, ordered by createdAt desc
    let query = adminDb
      .collection('auditLogs')
      .where('userId', '==', uid)
      .where('action', 'in', [...SYNC_ACTIONS]) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where('networkId', '==', networkId);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit + 1);

    // Apply cursor (document snapshot for keyset pagination)
    if (cursor) {
      const cursorDoc = await adminDb.collection('auditLogs').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    const history: SyncHistoryEntry[] = pageDocs.map((doc) => {
      const d = doc.data();
      const details = (d.details ?? d.metadata ?? {}) as Record<string, unknown>;
      const createdAt = toIso(d.createdAt);
      const completedAt = toIso(d.completedAt ?? details.completedAt) ?? null;
      const rowsFetched =
        typeof details.recordsStored === 'number'
          ? details.recordsStored
          : typeof details.rowsFetched === 'number'
          ? details.rowsFetched
          : null;
      const latencyMs =
        typeof details.latencyMs === 'number'
          ? details.latencyMs
          : completedAt && createdAt
          ? Math.max(0, new Date(completedAt).getTime() - new Date(createdAt).getTime())
          : null;

      return {
        id: doc.id,
        networkId: (d.networkId as string) ?? '',
        status: deriveStatus(d.action as string),
        triggeredBy: deriveTriggeredBy(details),
        triggeredAt: createdAt ?? new Date(0).toISOString(),
        completedAt,
        rowsFetched,
        latencyMs,
        errorMessage: typeof details.error === 'string' ? details.error : null,
      };
    });

    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ history, hasMore, nextCursor });
  } catch (error) {
    console.error('GET /api/scheduled/sync-history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
