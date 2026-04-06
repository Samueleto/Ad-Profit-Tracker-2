import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) return NextResponse.json({ notifications: [], unreadCount: 0, hasMore: false, nextCursor: null });

    const data = userDoc.data()!;
    let notifications = (data.notifications || []) as Array<{
      isDismissed: boolean;
      isRead: boolean;
      createdAt: { toDate?: () => Date } | string;
    }>;

    notifications = notifications.filter(n => !n.isDismissed);
    if (unreadOnly) notifications = notifications.filter(n => !n.isRead);

    const total = notifications.length;
    const unreadCount = notifications.filter(n => !n.isRead).length;
    const paginated = notifications.slice(0, limit);

    return NextResponse.json({
      notifications: paginated,
      unreadCount,
      hasMore: total > limit,
      nextCursor: total > limit ? String(limit) : null,
    });
  } catch (error) {
    console.error('notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    await adminDb.collection('users').doc(uid).update({
      notifications: FieldValue.delete(),
    });
    return NextResponse.json({ success: true, cleared: true });
  } catch (error) {
    console.error('DELETE /api/notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
