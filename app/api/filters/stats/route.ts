import { NextResponse } from 'next/server';
import NodeCache from 'node-cache';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { isValidNetworkId } from '@/lib/constants';
import { computeRoi } from '@/lib/roi/formula';

const statsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;
const VALID_METRICS = new Set(['revenue', 'cost', 'profit', 'roi', 'impressions', 'clicks', 'ctr', 'cpm']);
const VALID_DATA_QUALITY = new Set(['all', 'anomalies', 'clean']);

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const networksParam = searchParams.get('networks')?.split(',').filter(Boolean) || [];
    const countries = searchParams.get('countries')?.split(',').filter(Boolean) || [];
    const groupBy = searchParams.get('groupBy') || 'network';
    const metric = searchParams.get('metric') || 'revenue';
    const dataQuality = searchParams.get('dataQuality') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

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

    // Validate networks against allowlist — reject unknown IDs
    for (const n of networksParam) {
      if (!isValidNetworkId(n)) {
        return NextResponse.json({ error: `Invalid network ID: ${n}` }, { status: 400 });
      }
    }

    if (metric && !VALID_METRICS.has(metric)) {
      return NextResponse.json({ error: `Invalid metric: ${metric}` }, { status: 400 });
    }

    if (!VALID_DATA_QUALITY.has(dataQuality)) {
      return NextResponse.json({ error: "dataQuality must be one of: all, anomalies, clean" }, { status: 400 });
    }

    // Uid-prefixed cache key
    const cacheKey = `${uid}_filter_stats_${dateFrom}_${dateTo}_${networksParam.join(',')}_${groupBy}_${dataQuality}`;
    const cached = statsCache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    // All Firestore queries scoped to uid from verified token
    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;
    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const snapshot = await statsQuery.get();
    const aggregated: Record<string, { revenue: number; cost: number; impressions: number; clicks: number; rowCount: number }> = {};

    snapshot.forEach(doc => {
      const d = doc.data();
      if (networksParam.length > 0 && !networksParam.includes(d.networkId)) return;
      if (countries.length > 0 && !countries.includes(d.country)) return;
      if (dataQuality === 'anomalies' && d.validationStatus !== 'anomaly') return;
      if (dataQuality === 'clean' && d.validationStatus === 'anomaly') return;

      const key = groupBy === 'country' ? (d.country || 'unknown') : d.networkId;
      if (!aggregated[key]) aggregated[key] = { revenue: 0, cost: 0, impressions: 0, clicks: 0, rowCount: 0 };
      aggregated[key].revenue += d.revenue || 0;
      aggregated[key].cost += d.cost || 0;
      aggregated[key].impressions += d.impressions || 0;
      aggregated[key].clicks += d.clicks || 0;
      aggregated[key].rowCount++;
    });

    const rows = Object.entries(aggregated)
      .map(([key, stats]) => ({
        key,
        label: key,
        revenue: stats.revenue,
        cost: stats.cost,
        netProfit: stats.revenue - stats.cost,
        roi: computeRoi(stats.revenue, stats.cost),
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
        cpm: stats.impressions > 0 ? (stats.revenue / stats.impressions) * 1000 : 0,
        rowCount: stats.rowCount,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);

    const result = {
      rows,
      summary: {
        totalRevenue,
        totalCost,
        netProfit: totalRevenue - totalCost,
        roi: computeRoi(totalRevenue, totalCost),
      },
      filters: { networks: networksParam, countries, dataQuality },
      hasMore: false,
      nextCursor: null,
      cachedAt: new Date().toISOString(),
    };

    statsCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/filters/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
