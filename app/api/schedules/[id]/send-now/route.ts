import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// In-memory rate limit: max 3 test sends per hour per schedule
const sendNowRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { id } = await params;

  // Rate limit: 3 immediate sends per hour per schedule
  const rateKey = `${uid}:${id}`;
  const now = Date.now();
  const entry = sendNowRateLimit.get(rateKey);
  if (entry && now < entry.resetAt && entry.count >= 3) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many test sends. Please wait before sending again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    sendNowRateLimit.set(rateKey, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const doc = await adminDb.collection('schedules').doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const schedule = doc.data()!;

    // Only report_delivery schedules can be triggered via send-now
    if (schedule.type && schedule.type !== 'report_delivery') {
      return NextResponse.json(
        { error: 'send-now is only available for report delivery schedules' },
        { status: 400 }
      );
    }

    if (!schedule.deliveryEmail) {
      return NextResponse.json(
        { error: 'Schedule has no delivery email configured' },
        { status: 400 }
      );
    }

    // Enqueue an immediate delivery job — picked up by the report delivery worker
    const jobRef = await adminDb.collection('reportDeliveryJobs').add({
      uid,
      scheduleId: id,
      reportId: schedule.reportId ?? null,
      reportName: schedule.reportName ?? null,
      deliveryEmail: schedule.deliveryEmail,
      dateRangePreset: schedule.dateRangePreset ?? 'yesterday',
      format: schedule.format ?? 'pdf',
      timezone: schedule.timezone ?? 'UTC',
      triggeredBy: 'manual',
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Record the manual run on the schedule itself (non-blocking)
    doc.ref.update({
      lastRunAt: FieldValue.serverTimestamp(),
      lastRunStatus: null, // will be updated by the worker
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error('send-now schedule update failed:', err));

    return NextResponse.json({ success: true, jobId: jobRef.id });
  } catch (error) {
    console.error('POST /api/schedules/[id]/send-now error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
