import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token', code: 'invalid_token' }, { status: 400 });
  }

  try {
    // Look up invitation by token (server-side only — token is never returned to client)
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

    if (inv.status === 'accepted') {
      return NextResponse.json({ error: 'Invitation already used', code: 'already_used' }, { status: 410 });
    }
    if (inv.status === 'declined' || inv.status === 'revoked') {
      return NextResponse.json({ error: 'Invitation not found', code: 'not_found' }, { status: 404 });
    }
    if (inv.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer valid', code: 'invalid_token' }, { status: 410 });
    }

    // Check expiry
    const expiresAt: Date | null = inv.expiresAt?.toDate?.() ?? (inv.expiresAt ? new Date(inv.expiresAt) : null);
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired', code: 'expired' }, { status: 410 });
    }

    // Return only safe public fields — never expose token or tokenHash
    return NextResponse.json({
      invitation: {
        workspaceName: inv.workspaceName ?? '',
        invitedByName: inv.invitedByName ?? '',
        role: inv.role ?? 'member',
        invitedEmail: inv.invitedEmail ?? '',
      },
    });
  } catch (error) {
    console.error('GET /api/team/invitations/validate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
