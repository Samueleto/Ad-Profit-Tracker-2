import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Rate limit: 3 test emails/hour per uid
const testEmailRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkTestRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = testEmailRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    testEmailRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

async function resolveDeliveryEmail(uid: string): Promise<string | null> {
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const alertEmail = userDoc.data()?.notificationPreferences?.alertDeliveryEmail;
    if (alertEmail && typeof alertEmail === 'string') return alertEmail;
    const user = await adminAuth.getUser(uid);
    return user.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkTestRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many test emails. Maximum 3 per hour.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    // Delivery email always from Firestore/Auth — never from request body
    const deliveryEmail = await resolveDeliveryEmail(uid);
    if (!deliveryEmail) {
      return NextResponse.json({ error: 'No delivery email configured for this user' }, { status: 422 });
    }

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'send_test_email',
      resourceType: 'email',
      metadata: { deliveryEmail },
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, deliveryEmail });
  } catch (error) {
    console.error('POST /api/email/send-test error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
