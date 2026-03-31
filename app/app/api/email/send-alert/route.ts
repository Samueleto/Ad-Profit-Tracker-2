import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Constant-time comparison for x-internal-secret
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

// Rate limit: 10 alert emails/hour per uid per alertType
const alertRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkAlertRateLimit(uid: string, alertType: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${uid}_${alertType}`;
  const entry = alertRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    alertRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

const VALID_ALERT_TYPES = new Set(['sync_failure', 'reconciliation_anomaly', 'low_balance', 'roi_alert', 'test']);

// Resolve delivery email from Firestore or Firebase Auth — never from the request body
async function resolveDeliveryEmail(uid: string): Promise<string | null> {
  try {
    // Prefer user-configured alert email if set
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const alertEmail = userDoc.data()?.notificationPreferences?.alertDeliveryEmail;
    if (alertEmail && typeof alertEmail === 'string') return alertEmail;

    // Fall back to Firebase Auth email
    const user = await adminAuth.getUser(uid);
    return user.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const internalSecret = request.headers.get('x-internal-secret');

  let uid: string;

  // ─── Dual-auth: strictly either/or ───────────────────────────────────────
  // If Authorization is present, treat as user request (Firebase token path).
  // Never allow both paths simultaneously.
  if (authHeader) {
    const authResult = await verifyAuthToken(request);
    if ('error' in authResult) return authResult.error;
    uid = authResult.token.uid;
  } else if (internalSecret) {
    const secret = process.env.INTERNAL_SYNC_SECRET;
    if (!secret) {
      console.error('INTERNAL_SYNC_SECRET is not configured');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!safeCompare(internalSecret, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Internal path: userId must come from request body
    const body = await request.json().catch(() => ({}));
    if (!body.userId || typeof body.userId !== 'string') {
      return NextResponse.json({ error: 'userId is required for internal requests' }, { status: 400 });
    }
    uid = body.userId;

    // Rate limit and send for internal path
    const alertType = typeof body.alertType === 'string' ? body.alertType : 'test';
    if (!VALID_ALERT_TYPES.has(alertType)) {
      return NextResponse.json({ error: 'Invalid alert type' }, { status: 400 });
    }
    const rl = checkAlertRateLimit(uid, alertType);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 alert emails per hour per type.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
      );
    }
    const deliveryEmail = await resolveDeliveryEmail(uid);
    if (!deliveryEmail) {
      return NextResponse.json({ error: 'No delivery email configured for this user' }, { status: 422 });
    }
    // Fire-and-forget audit log
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'send_alert_email',
      resourceType: 'email',
      metadata: { alertType, deliveryEmail, source: 'internal' },
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));
    return NextResponse.json({ success: true, deliveryEmail, alertType });
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Firebase token path continues here
  try {
    const body = await request.json().catch(() => ({}));
    const alertType = typeof body.alertType === 'string' ? body.alertType : 'test';
    if (!VALID_ALERT_TYPES.has(alertType)) {
      return NextResponse.json({ error: 'Invalid alert type' }, { status: 400 });
    }

    const rl = checkAlertRateLimit(uid, alertType);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 alert emails per hour per type.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
      );
    }

    // Delivery email always from Firestore/Auth — ignore any 'to' in request body
    const deliveryEmail = await resolveDeliveryEmail(uid);
    if (!deliveryEmail) {
      return NextResponse.json({ error: 'No delivery email configured for this user' }, { status: 422 });
    }

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'send_alert_email',
      resourceType: 'email',
      metadata: { alertType, deliveryEmail, source: 'user' },
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, deliveryEmail, alertType });
  } catch (error) {
    console.error('POST /api/email/send-alert error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
