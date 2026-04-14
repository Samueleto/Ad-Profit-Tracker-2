import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    if (!q) {
      return NextResponse.json({ articles: [] });
    }

    // Firestore doesn't support full-text search; fetch published articles
    // then filter client-side on title, summary, and tags.
    let query = adminDb
      .collection('helpArticles')
      .where('isPublished', '==', true) as FirebaseFirestore.Query;

    if (category) {
      query = query.where('category', '==', category);
    }

    // Fetch more than needed so we can filter and still return `limit` results
    query = query.orderBy('updatedAt', 'desc').limit(500);

    const snapshot = await query.get();

    const terms = q.split(/\s+/).filter(Boolean);

    const articles = snapshot.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title as string ?? '',
          slug: d.slug as string ?? '',
          category: d.category as string ?? '',
          summary: d.summary as string ?? '',
          tags: (d.tags as string[]) ?? [],
          readTimeMinutes: d.readTimeMinutes ?? 5,
          viewCount: d.viewCount ?? 0,
          helpfulCount: d.helpfulCount ?? 0,
        };
      })
      .filter((a) => {
        const haystack = [a.title, a.summary, ...a.tags].join(' ').toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, limit);

    return NextResponse.json({ articles, total: articles.length });
  } catch (error) {
    console.error('GET /api/help/search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
