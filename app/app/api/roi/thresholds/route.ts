import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';
import { ROI_THRESHOLD_DEFAULTS } from '@/lib/roi/defaults';

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

    Object.keys(ROI_THRESHOLD_DEFAULTS).forEach(key => {
      if (data[key] === undefined) usingDefaults.push(key);
    });

    return NextResponse.json({
      ...ROI_THRESHOLD_DEFAULTS,
      ...data,
      usingDefaults,
    });
  } catch (error) {
    console.error('roi/thresholds GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const allowedFields = ['positiveThreshold', 'warningThreshold', 'criticalThreshold', 'targetRoi', 'alertOnNegative', 'alertOnTargetMiss'];
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    await adminDb.collection('roiThresholds').doc(uid).set(
      { userId: uid, ...update },
      { merge: true }
    );

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
