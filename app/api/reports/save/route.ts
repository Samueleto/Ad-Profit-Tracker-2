import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { validateReportConfig } from '@/lib/reportValidation';

const MAX_REPORTS_PER_USER = 50;
const MAX_NAME_LENGTH = 100;

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, config } = body as { name?: unknown; config?: unknown };

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `name must be ${MAX_NAME_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return NextResponse.json({ error: 'config is required and must be an object' }, { status: 400 });
  }

  const validation = validateReportConfig(config as Record<string, unknown>);
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid config', errors: validation.errors }, { status: 400 });
  }

  try {
    // Enforce per-user cap to prevent runaway storage
    const countSnap = await adminDb
      .collection('reports')
      .where('uid', '==', uid)
      .count()
      .get();
    const currentCount = countSnap.data().count;
    if (currentCount >= MAX_REPORTS_PER_USER) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_REPORTS_PER_USER} reports. Delete some to make room.` },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const docRef = adminDb.collection('reports').doc();

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
    console.error('POST /api/reports/save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
