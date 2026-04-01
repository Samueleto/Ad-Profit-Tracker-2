import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { isValidNetworkId } from '@/lib/constants';
import { serializeDoc } from '@/lib/networks/network-helpers';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const rawQ = searchParams.get('q') || searchParams.get('searchQuery') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const networkId = searchParams.get('networkId') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    // Validate and sanitize search query
    const q = rawQ.trim().slice(0, 100);
    if (!q) {
      return NextResponse.json({ error: 'q must be a non-empty string' }, { status: 400 });
    }

    // Date validation
    if (dateFrom && !DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: 'dateFrom must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (dateTo && !DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: 'dateTo must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) return NextResponse.json({ error: 'dateFrom must be <= dateTo' }, { status: 400 });
      const diff = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
      if (diff > MAX_RANGE_DAYS) {
        return NextResponse.json({ error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 });
      }
    }

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: 'Invalid networkId' }, { status: 400 });
    }

    // Search adStats scoped to uid
    let query = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;

    if (networkId) query = query.where('networkId', '==', networkId);
    if (dateFrom) query = query.where('date', '>=', dateFrom);

    const snapshot = await query.limit(500).get();
    let docs = snapshot.docs.map(serializeDoc).filter(Boolean);

    if (dateTo) {
      docs = docs.filter((d) => {
        const date = (d as Record<string, unknown>)?.date;
        return typeof date === 'string' && date <= dateTo;
      });
    }

    // Filter by search query (matches country or networkId)
    const qLower = q.toLowerCase();
    const results = docs
      .filter((d) => {
        const row = d as Record<string, unknown>;
        const country = String(row.country || '').toLowerCase();
        const network = String(row.networkId || '').toLowerCase();
        return country.includes(qLower) || network.includes(qLower);
      })
      .slice(0, limit);

    return NextResponse.json({ results, total: results.length, q });
  } catch (error) {
    console.error('GET /api/filters/search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
