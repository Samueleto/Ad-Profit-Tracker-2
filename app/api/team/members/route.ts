import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userData = userDoc.data()!;
    const workspaceId = userData.workspaceId;

    if (!workspaceId) {
      // Return just the current user as the only member
      return NextResponse.json({
        members: [{
          uid,
          displayName: userData.displayName,
          email: userData.email,
          workspaceRole: 'owner',
          workspaceJoinedAt: userData.createdAt?.toDate?.()?.toISOString() ?? null,
          photoURL: userData.photoURL,
        }],
        total: 1,
      });
    }

    const membersSnapshot = await adminDb
      .collection('users')
      .where('workspaceId', '==', workspaceId)
      .get();

    const members = membersSnapshot.docs.map(doc => {
      const d = doc.data();
      return {
        uid: doc.id,
        displayName: d.displayName,
        email: d.email,
        workspaceRole: d.workspaceRole ?? 'member',
        workspaceJoinedAt: d.workspaceJoinedAt?.toDate?.()?.toISOString() ?? null,
        photoURL: d.photoURL ?? null,
      };
    });

    return NextResponse.json({ members, total: members.length });
  } catch (error) {
    console.error('team/members GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
