import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminAuth } from '@/lib/firebase-admin/admin';

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

// Rate limit: 1 summary email/day per uid per summaryType
const summaryRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

function checkSummaryRateLimit(uid: string, summaryType: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${uid}_${summaryType}`;
  const entry = summaryRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    summaryRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= 1) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

const VALID_SUMMARY_TYPES = new Set(['weekly', 'monthly', 'daily']);

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
  // Internal-only endpoint — reject any Firebase Bearer token (Authorization header)
  // to prevent end-users from calling this directly.
  if (request.headers.get('authorization')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const internalSecret = request.headers.get('x-internal-secret');
  if (!internalSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    const { userId, summaryType = 'weekly' } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!VALID_SUMMARY_TYPES.has(summaryType)) {
      return NextResponse.json({ error: 'Invalid summaryType' }, { status: 400 });
    }

    const rl = checkSummaryRateLimit(userId, summaryType);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Only 1 ${summaryType} summary email per day.` },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 86400) } }
      );
    }

    // Delivery email always from Firestore/Auth — never from request body
    const deliveryEmail = await resolveDeliveryEmail(userId);
    if (!deliveryEmail) {
      return NextResponse.json({ error: 'No delivery email configured for this user' }, { status: 422 });
    }

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId,
      action: 'send_summary_email',
      resourceType: 'email',
      details: { summaryType, deliveryEmail },
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, deliveryEmail, summaryType });
  } catch (error) {
    console.error('POST /api/email/send-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
