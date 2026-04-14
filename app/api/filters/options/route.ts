import { NextResponse } from 'next/server';
import NodeCache from 'node-cache';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { SUPPORTED_NETWORKS } from '@/lib/constants';

const optionsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;
const VALID_TYPES = new Set(['country', 'network', 'metric', 'all']);

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('from') || '';
    const dateTo = searchParams.get('dateTo') || searchParams.get('to') || '';

    // Validate type param
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: "type must be one of: country, network, metric, all" }, { status: 400 });
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

    // Uid-prefixed cache key — prevents cross-user cache hits
    const cacheKey = `${uid}_filter_options_${type}_${dateFrom}_${dateTo}`;
    const cached = optionsCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    // All Firestore queries scoped to uid from verified token
    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();

    const countriesSet = new Set<string>();
    const networksWithData = new Set<string>();

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.country) countriesSet.add(d.country);
      if (d.networkId) networksWithData.add(d.networkId);
    });

    const countries = Array.from(countriesSet).sort().map(c => ({
      code: c,
      name: c,
      hasData: true,
    }));

    const networks = SUPPORTED_NETWORKS.map(networkId => ({
      networkId,
      label: networkId.charAt(0).toUpperCase() + networkId.slice(1),
      dataRole: networkId === 'exoclick' ? 'cost' as const : 'revenue' as const,
      hasData: networksWithData.has(networkId),
    }));

    const metrics = [
      { metric: 'revenue', label: 'Revenue', unit: 'USD' },
      { metric: 'cost', label: 'Cost', unit: 'USD' },
      { metric: 'profit', label: 'Net Profit', unit: 'USD' },
      { metric: 'roi', label: 'ROI', unit: '%' },
      { metric: 'impressions', label: 'Impressions', unit: 'count' },
      { metric: 'clicks', label: 'Clicks', unit: 'count' },
      { metric: 'ctr', label: 'CTR', unit: '%' },
      { metric: 'cpm', label: 'CPM', unit: 'USD' },
    ];

    const result: Record<string, unknown> = { dateFrom, dateTo, cachedAt: new Date().toISOString() };
    if (type === 'all' || type === 'country') result.countries = countries;
    if (type === 'all' || type === 'network') result.networks = networks;
    if (type === 'all' || type === 'metric') result.metrics = metrics;

    optionsCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/filters/options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
