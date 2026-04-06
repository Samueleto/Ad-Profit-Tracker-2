import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;
  const email = authResult.token.email;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required', code: 'invalid_token' }, { status: 400 });
  }

  try {
    const snap = await adminDb
      .collection('teamInvitations')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Invitation not found', code: 'not_found' }, { status: 404 });
    }

    const doc = snap.docs[0];
    const inv = doc.data();

    if (inv.status !== 'pending') {
      // Idempotent — declining an already-declined invite is a no-op success
      if (inv.status === 'declined') {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Invitation is no longer valid', code: 'invalid_token' }, { status: 410 });
    }

    // Soft email match
    if (email && inv.invitedEmail && inv.invitedEmail !== email) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address', code: 'invalid_token' },
        { status: 403 }
      );
    }

    await doc.ref.update({
      status: 'declined',
      declinedAt: FieldValue.serverTimestamp(),
      declinedByUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/team/invitations/decline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
