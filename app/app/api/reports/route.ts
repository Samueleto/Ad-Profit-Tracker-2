import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';
import { validateReportConfig } from '@/lib/reportValidation';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ reports: [], total: 0 });
    }

    const data = userDoc.data()!;
    const reports = data.savedReports || [];

    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error('reports GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { name, ...config } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const validation = validateReportConfig(config);
    if (!validation.valid) {
      return NextResponse.json({ error: 'Invalid config', errors: validation.errors }, { status: 400 });
    }

    const now = new Date().toISOString();
    const report = {
      id: uuidv4(),
      name,
      ...config,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.collection('users').doc(uid).update({
      savedReports: FieldValue.arrayUnion(report),
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error('reports POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
