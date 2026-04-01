import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';

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

const VALID_SUMMARY_TYPES = new Set(['weekly', 'monthly', 'daily']);

export async function POST(request: Request) {
  // Internal-only endpoint — reject any Firebase Bearer token (Authorization header)
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
    const { summaryType = 'weekly', scheduledFor } = body;

    if (!VALID_SUMMARY_TYPES.has(summaryType)) {
      return NextResponse.json({ error: 'Invalid summaryType' }, { status: 400 });
    }

    // Queue the summary job — fire-and-forget audit log
    adminDb.collection('scheduledEmailJobs').add({
      summaryType,
      scheduledFor: scheduledFor ?? null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('scheduled email job write failed:', err));

    adminDb.collection('auditLogs').add({
      action: 'schedule_summary_email',
      resourceType: 'email',
      metadata: { summaryType, scheduledFor },
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true, summaryType });
  } catch (error) {
    console.error('POST /api/email/schedule-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
