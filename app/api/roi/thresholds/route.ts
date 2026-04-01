import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';
import { ROI_THRESHOLD_DEFAULTS } from '@/lib/roi/defaults';

// In-memory rate limit: 20 PATCH updates per hour per uid
const thresholdRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkThresholdRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = thresholdRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    thresholdRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const ALLOWED_FIELDS = [
  'positiveThreshold',
  'warningThreshold',
  'criticalThreshold',
  'targetRoi',
  'alertOnNegative',
  'alertOnTargetMiss',
];

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const doc = await adminDb.collection('roiThresholds').doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({ ...ROI_THRESHOLD_DEFAULTS, usingDefaults: Object.keys(ROI_THRESHOLD_DEFAULTS) });
    }

    const data = doc.data()!;
    const usingDefaults: string[] = [];
    Object.keys(ROI_THRESHOLD_DEFAULTS).forEach((key) => {
      if (data[key] === undefined) usingDefaults.push(key);
    });

    return NextResponse.json({ ...ROI_THRESHOLD_DEFAULTS, ...data, usingDefaults });
  } catch (error) {
    console.error('roi/thresholds GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit check before any Firestore reads or writes
  if (!checkThresholdRateLimit(uid)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 20 threshold updates per hour.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Capture before-state for audit log
    const beforeDoc = await adminDb.collection('roiThresholds').doc(uid).get();
    const beforeData = beforeDoc.exists ? beforeDoc.data()! : {};

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const changedFields: Record<string, { before: unknown; after: unknown }> = {};

    for (const field of ALLOWED_FIELDS) {
      if ((body as Record<string, unknown>)[field] !== undefined) {
        update[field] = (body as Record<string, unknown>)[field];
        changedFields[field] = {
          before: beforeData[field] ?? null,
          after: update[field],
        };
      }
    }

    // Write scoped to users/{uid}/roiThresholds — cannot touch another user's doc
    await adminDb
      .collection('roiThresholds')
      .doc(uid)
      .set({ userId: uid, ...update }, { merge: true });

    // Fire-and-forget audit log with before/after values
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'roi_thresholds_updated',
      details: { changedFields },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err) => console.error('Audit log write failed:', err));

    const updatedDoc = await adminDb.collection('roiThresholds').doc(uid).get();
    const data = updatedDoc.data()!;

    return NextResponse.json({
      ...ROI_THRESHOLD_DEFAULTS,
      ...data,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error('roi/thresholds PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
