import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';
import { validateReportConfig } from '@/lib/reportValidation';
import { serializeDoc } from '@/lib/networks/network-helpers';

const MAX_REPORTS_PER_USER = 50;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    // Query the reports collection — consistent with /api/reports/save and /api/reports/[id]
    const snapshot = await adminDb
      .collection('reports')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const reports = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error('GET /api/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, config: bodyConfig, ...rest } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Accept config either nested ({ name, config }) or spread ({ name, metrics, ... })
  const config = (bodyConfig && typeof bodyConfig === 'object' && !Array.isArray(bodyConfig))
    ? bodyConfig as Record<string, unknown>
    : rest;

  const validation = validateReportConfig(config);
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid config', errors: validation.errors }, { status: 400 });
  }

  try {
    // Enforce per-user cap
    const countSnap = await adminDb
      .collection('reports')
      .where('uid', '==', uid)
      .count()
      .get();
    if (countSnap.data().count >= MAX_REPORTS_PER_USER) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_REPORTS_PER_USER} reports. Delete some to make room.` },
        { status: 422 }
      );
    }

    const docRef = adminDb.collection('reports').doc();
    const now = new Date().toISOString();
    await docRef.set({
      uid,
      name: name.trim(),
      config,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { id: docRef.id, name: name.trim(), config, createdAt: now, updatedAt: now },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
