import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { computeRoi } from '@/lib/roi/formula';
import { isValidNetworkId } from '@/lib/constants';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;
const VALID_METRICS = new Set(['roi', 'ctr', 'cpm', 'revenue', 'cost', 'impressions', 'clicks']);

export async function GET(request: Request) {
  // Token verification first — before any Firestore reads
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const metric = searchParams.get('metric') || 'roi';
    const networkId = searchParams.get('networkId') || null;

    // Input validation
    if (dateFrom && !DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: 'dateFrom must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (dateTo && !DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: 'dateTo must be in YYYY-MM-DD format' }, { status: 400 });
    }
    if (dateFrom && dateTo) {
      const diff = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
      if (diff > MAX_RANGE_DAYS) {
        return NextResponse.json({ error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 });
      }
    }
    if (!VALID_METRICS.has(metric)) {
      return NextResponse.json({ error: 'Invalid metric' }, { status: 400 });
    }
    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: 'Invalid networkId' }, { status: 400 });
    }

    // Get benchmark settings — uid used as document key (no separate query filter needed)
    const benchmarkDoc = await adminDb.collection('benchmarks').doc(uid).get();
    const benchmarkData = benchmarkDoc.exists ? benchmarkDoc.data() : null;

    const systemDefaults: Record<string, number> = {
      roi: 10,
      ctr: 2,
      cpm: 1.5,
      revenue: 1000,
      cost: 500,
      impressions: 100000,
      clicks: 2000,
    };

    const historicalWindowDays = benchmarkData?.historicalWindowDays ?? 30;
    const metricTargets = benchmarkData?.metricTargets ?? {};
    const effectiveTarget = metricTargets[metric]?.useDefault === false && metricTargets[metric]?.customTarget != null
      ? metricTargets[metric].customTarget
      : systemDefaults[metric] ?? 0;

    // Query current period stats — uid always from verified token, never from params
    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;

    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);
    if (networkId) statsQuery = statsQuery.where('networkId', '==', networkId);

    const statsSnapshot = await statsQuery.get();
    let totalRevenue = 0, totalCost = 0, totalImpressions = 0, totalClicks = 0;

    statsSnapshot.forEach(doc => {
      const d = doc.data();
      totalRevenue += d.revenue || 0;
      totalCost += d.cost || 0;
      totalImpressions += d.impressions || 0;
      totalClicks += d.clicks || 0;
    });

    let actualValue: number | null = null;
    if (metric === 'roi') actualValue = computeRoi(totalRevenue, totalCost);
    else if (metric === 'revenue') actualValue = totalRevenue;
    else if (metric === 'cost') actualValue = totalCost;
    else if (metric === 'impressions') actualValue = totalImpressions;
    else if (metric === 'clicks') actualValue = totalClicks;
    else if (metric === 'ctr') actualValue = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

    const vsIndustry = actualValue != null ? actualValue - effectiveTarget : null;
    const performanceRatio = actualValue != null && effectiveTarget > 0 ? actualValue / effectiveTarget : null;

    let trend: 'above' | 'below' | 'at' | 'no_data' = 'no_data';
    if (actualValue != null) {
      if (actualValue > effectiveTarget) trend = 'above';
      else if (actualValue < effectiveTarget) trend = 'below';
      else trend = 'at';
    }

    return NextResponse.json({
      dateFrom,
      dateTo,
      metric,
      networkId,
      actual: { value: actualValue, unit: metric === 'roi' || metric === 'ctr' ? '%' : 'USD' },
      historicalAverage: { value: null, daysUsed: 0, windowDays: historicalWindowDays },
      industryBenchmark: {
        value: effectiveTarget,
        isCustom: !!(metricTargets[metric] && !metricTargets[metric].useDefault),
        source: metricTargets[metric] && !metricTargets[metric].useDefault ? 'custom' : 'system_default',
      },
      gaps: { vsHistorical: null, vsIndustry },
      performanceRatio,
      trend,
      cachedAt: null,
    });
  } catch (error) {
    console.error('benchmarks/performance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
