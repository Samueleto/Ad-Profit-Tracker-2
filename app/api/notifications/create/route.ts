import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Constant-time string comparison to prevent timing attacks on secret comparison.
// Pads both strings to the same fixed length before comparing so length differences
// don't leak information through timing.
function safeCompare(a: string, b: string): boolean {
  try {
    const len = Math.max(a.length, b.length, 32);
    const aBuf = Buffer.alloc(len);
    const bBuf = Buffer.alloc(len);
    aBuf.write(a);
    bBuf.write(b);
    return timingSafeEqual(aBuf, bBuf) && a.length === b.length;
  } catch {
    return false;
  }
}

const VALID_TYPES = new Set(['info', 'success', 'warning', 'error', 'sync', 'reconciliation']);

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const internalSecret = request.headers.get('x-internal-secret');

  // ─── Dual-auth: Firebase token takes priority ──────────────────────────────
  // Never allow both paths simultaneously — if Authorization is present, treat
  // it as a user request (ignore x-internal-secret and any userId in the body).
  if (authHeader) {
    const authResult = await verifyAuthToken(request);
    if ('error' in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const body = await request.json().catch(() => ({}));
      const { type = 'info', title, message } = body;

      if (!title || typeof title !== 'string') {
        return NextResponse.json({ error: 'title is required' }, { status: 400 });
      }
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
      }
      if (!VALID_TYPES.has(type)) {
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
      }

      // uid always from verified token — ignore any userId in the request body
      const ref = await adminDb.collection('notifications').add({
        uid,
        type,
        title: title.trim().slice(0, 200),
        message: message.trim().slice(0, 1000),
        isRead: false,
        isDismissed: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: ref.id });
    } catch (error) {
      console.error('POST /api/notifications/create (user) error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // ─── Internal path: x-internal-secret ─────────────────────────────────────
  // Used by Cloud Scheduler / server-side jobs. Never trust a Firebase token here.
  if (internalSecret) {
    const secret = process.env.INTERNAL_SYNC_SECRET;
    if (!secret) {
      console.error('INTERNAL_SYNC_SECRET is not configured');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!safeCompare(internalSecret, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const { userId, type = 'info', title, message } = body;

      if (!userId || typeof userId !== 'string') {
        return NextResponse.json({ error: 'userId is required for internal requests' }, { status: 400 });
      }
      if (!title || typeof title !== 'string') {
        return NextResponse.json({ error: 'title is required' }, { status: 400 });
      }
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
      }
      if (!VALID_TYPES.has(type)) {
        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
      }

      const ref = await adminDb.collection('notifications').add({
        uid: userId,
        type,
        title: title.trim().slice(0, 200),
        message: message.trim().slice(0, 1000),
        isRead: false,
        isDismissed: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: ref.id });
    } catch (error) {
      console.error('POST /api/notifications/create (internal) error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Neither Firebase token nor internal secret — reject
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
