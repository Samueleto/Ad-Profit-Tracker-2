import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Rate limit: 10 clear-all actions/hour per uid
const clearRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkClearRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = clearRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    clearRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkClearRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many clear-all requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const snapshot = await adminDb
      .collection('notifications')
      .where('uid', '==', uid)
      .get();

    const clearedCount = snapshot.size;

    if (!snapshot.empty) {
      const batch = adminDb.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'clear_all',
      resourceType: 'notification',
      metadata: { clearedCount },
      status: 'success',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, cleared: clearedCount });
  } catch (error) {
    // Audit log on failure — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'clear_all',
      resourceType: 'notification',
      metadata: {},
      status: 'failure',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    console.error('DELETE /api/notifications/clear error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
