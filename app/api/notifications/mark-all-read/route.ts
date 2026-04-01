import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Rate limit: 30 mark-all-read actions/hour per uid
const markAllReadRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkMarkAllReadRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = markAllReadRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    markAllReadRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkMarkAllReadRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many mark-all-read requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const snapshot = await adminDb
      .collection('notifications')
      .where('uid', '==', uid)
      .where('isRead', '==', false)
      .get();

    if (snapshot.empty) return NextResponse.json({ success: true, marked: 0 });

    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { isRead: true, readAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();

    return NextResponse.json({ success: true, marked: snapshot.size });
  } catch (error) {
    console.error('PATCH /api/notifications/mark-all-read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
