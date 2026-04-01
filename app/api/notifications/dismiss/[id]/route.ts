import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Rate limit: 60 dismiss actions/hour per uid
const dismissRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkDismissRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = dismissRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    dismissRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkDismissRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many dismissals. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const { id } = await params;
    const doc = await adminDb.collection('notifications').doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await doc.ref.update({
      isDismissed: true,
      dismissedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/notifications/dismiss/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
