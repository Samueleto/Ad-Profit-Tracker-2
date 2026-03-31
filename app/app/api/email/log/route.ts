import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);

    // uid filter is a Firestore query filter — not a post-fetch filter
    // This ensures users can never access each other's email history
    const snapshot = await adminDb
      .collection('auditLogs')
      .where('userId', '==', uid)
      .where('resourceType', '==', 'email')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      // Never expose delivery email in the log response to prevent enumeration
      const { ...rest } = data;
      delete rest.metadata?.deliveryEmail;
      return { id: doc.id, ...rest };
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('GET /api/email/log error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
