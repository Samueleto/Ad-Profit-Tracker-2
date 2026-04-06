import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

const VALID_RATINGS = new Set(['helpful', 'not_helpful']);

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

  const { articleId, rating } = body;

  if (!articleId || typeof articleId !== 'string' || articleId.length > 200) {
    return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
  }
  if (!rating || typeof rating !== 'string' || !VALID_RATINGS.has(rating)) {
    return NextResponse.json({ error: 'rating must be helpful or not_helpful' }, { status: 400 });
  }

  try {
    // One feedback record per user per article — upsert to prevent duplicates
    const feedbackRef = adminDb
      .collection('helpFeedback')
      .doc(`${uid}_${articleId}`);

    await feedbackRef.set(
      {
        uid,
        articleId,
        rating,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Increment aggregate counters on the article doc (fire-and-forget)
    const articleRef = adminDb.collection('helpArticles').doc(articleId);
    const field = rating === 'helpful' ? 'helpfulCount' : 'notHelpfulCount';
    articleRef.update({ [field]: FieldValue.increment(1) })
      .catch((err: Error) => console.error('helpArticle counter update failed:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/help/feedback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
