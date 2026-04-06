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

    // Validate status
    if (inv.status === 'accepted') {
      return NextResponse.json({ error: 'Invitation already used', code: 'already_used' }, { status: 409 });
    }
    if (inv.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer valid', code: 'invalid_token' }, { status: 410 });
    }

    // Check expiry
    const expiresAt: Date | null = inv.expiresAt?.toDate?.() ?? (inv.expiresAt ? new Date(inv.expiresAt) : null);
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired', code: 'expired' }, { status: 410 });
    }

    // Email match (soft check — token match is the primary guard)
    if (email && inv.invitedEmail && inv.invitedEmail !== email) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address', code: 'invalid_token' },
        { status: 403 }
      );
    }

    // Check if already a member of this workspace
    if (inv.workspaceId) {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists && userDoc.data()?.workspaceId === inv.workspaceId) {
        return NextResponse.json({ error: 'You are already a member of this workspace', code: 'already_member' }, { status: 409 });
      }
    }

    // Transactionally accept: update user, mark invitation accepted
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(uid);
      tx.update(userRef, {
        workspaceId: inv.workspaceId ?? null,
        workspaceRole: inv.role ?? 'member',
        workspaceJoinedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(doc.ref, {
        status: 'accepted',
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedByUid: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/team/invitations/accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
