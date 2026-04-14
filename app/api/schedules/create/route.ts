import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { serializeDoc } from '@/lib/networks/network-helpers';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'monthly']);
const VALID_FORMATS = new Set(['excel', 'pdf']);
const VALID_PRESETS = new Set(['yesterday', 'last_7', 'last_30', 'last_90', 'this_month']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SCHEDULES_PER_USER = 20;

// In-memory rate limit: 10 creates per hour per uid
const createRateLimit = new Map<string, { count: number; resetAt: number }>();

// ─── Next run time computation ────────────────────────────────────────────────

function computeNextRunAt(
  frequency: string,
  deliveryHour: number,
  dayOfWeek: number | null,
  dayOfMonth: number | null
): Date {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(deliveryHour);

  // Advance to tomorrow if today's delivery hour has already passed
  if (next <= now) next.setDate(next.getDate() + 1);

  if (frequency === 'weekly' && dayOfWeek != null) {
    const targetDay = ((dayOfWeek % 7) + 7) % 7;
    while (next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1);
    }
  } else if (frequency === 'monthly' && dayOfMonth != null) {
    const clampedDay = Math.min(dayOfMonth, 28);
    next.setDate(clampedDay);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(clampedDay);
    }
  }

  return next;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 10 creates per hour
  const now = Date.now();
  const entry = createRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 10) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "You've reached the schedule creation limit. Try again later." },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    createRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ─── Input validation ─────────────────────────────────────────────────────

  const fieldErrors: Record<string, string> = {};

  const reportId = body.reportId;
  const reportName = body.reportName;
  const frequency = body.frequency as string | undefined;
  const dayOfWeek = body.dayOfWeek != null ? Number(body.dayOfWeek) : null;
  const dayOfMonth = body.dayOfMonth != null ? Number(body.dayOfMonth) : null;
  const deliveryHour = body.deliveryHour != null ? Number(body.deliveryHour) : null;
  const timezone = body.timezone;
  const deliveryEmail = typeof body.deliveryEmail === 'string' ? body.deliveryEmail.trim() : '';
  const dateRangePreset = body.dateRangePreset as string | undefined;
  const format = body.format as string | undefined;
  const isActive = body.isActive !== false; // default true

  if (!reportId || typeof reportId !== 'string') fieldErrors.reportId = 'reportId is required.';
  if (!reportName || typeof reportName !== 'string') fieldErrors.reportName = 'reportName is required.';
  if (!frequency || !VALID_FREQUENCIES.has(frequency)) {
    fieldErrors.frequency = 'frequency must be daily, weekly, or monthly.';
  }
  if (frequency === 'weekly') {
    if (dayOfWeek == null || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      fieldErrors.dayOfWeek = 'dayOfWeek must be 0–6 for weekly schedules.';
    }
  }
  if (frequency === 'monthly') {
    if (dayOfMonth == null || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      fieldErrors.dayOfMonth = 'dayOfMonth must be 1–28 for monthly schedules.';
    }
  }
  if (deliveryHour == null || !Number.isInteger(deliveryHour) || deliveryHour < 0 || deliveryHour > 23) {
    fieldErrors.deliveryHour = 'deliveryHour must be 0–23.';
  }
  if (!timezone || typeof timezone !== 'string' || timezone.length > 100) {
    fieldErrors.timezone = 'timezone is required.';
  }
  if (!deliveryEmail || !EMAIL_RE.test(deliveryEmail)) {
    fieldErrors.deliveryEmail = 'A valid delivery email is required.';
  }
  if (!dateRangePreset || !VALID_PRESETS.has(dateRangePreset)) {
    fieldErrors.dateRangePreset = 'Invalid dateRangePreset.';
  }
  if (!format || !VALID_FORMATS.has(format)) {
    fieldErrors.format = 'format must be excel or pdf.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ message: 'Validation failed.', fieldErrors }, { status: 400 });
  }

  try {
    // Enforce per-user cap
    const countSnap = await adminDb
      .collection('schedules')
      .where('uid', '==', uid)
      .where('type', '==', 'report_delivery')
      .count()
      .get();
    if (countSnap.data().count >= MAX_SCHEDULES_PER_USER) {
      return NextResponse.json(
        { error: `You can have up to ${MAX_SCHEDULES_PER_USER} scheduled reports. Delete some to make room.` },
        { status: 422 }
      );
    }

    const nextRunAt = computeNextRunAt(
      frequency!,
      deliveryHour!,
      frequency === 'weekly' ? dayOfWeek : null,
      frequency === 'monthly' ? dayOfMonth : null
    );

    const ref = adminDb.collection('schedules').doc();
    await ref.set({
      uid,
      type: 'report_delivery',
      reportId,
      reportName,
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : null,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
      deliveryHour,
      timezone,
      deliveryEmail,
      dateRangePreset,
      format,
      isActive,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunError: null,
      nextRunAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ schedule: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/schedules/create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
