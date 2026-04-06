import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { computeRoi } from '@/lib/roi/formula';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

const SYSTEM_DEFAULTS: Record<string, number> = {
  roi: 10,
  ctr: 2,
  cpm: 1.5,
};

// Weights for composite score (must sum to 1)
const METRIC_WEIGHTS: Record<string, number> = {
  roi: 0.5,
  ctr: 0.3,
  cpm: 0.2,
};

/**
 * Clamp a ratio to [0, 1] and convert to a 0–100 score.
 * For CPM, lower is better — so the ratio is inverted.
 */
function ratioToScore(actual: number, target: number, lowerIsBetter = false): number {
  if (target <= 0) return 50; // no meaningful target → neutral
  const ratio = lowerIsBetter ? target / actual : actual / target;
  return Math.min(100, Math.max(0, ratio * 100));
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  if (dateFrom && !DATE_RE.test(dateFrom)) {
    return NextResponse.json({ error: 'dateFrom must be in YYYY-MM-DD format' }, { status: 400 });
  }
  if (dateTo && !DATE_RE.test(dateTo)) {
    return NextResponse.json({ error: 'dateTo must be in YYYY-MM-DD format' }, { status: 400 });
  }
  if (dateFrom && dateTo) {
    const diff = Math.round(
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000
    );
    if (diff < 0) {
      return NextResponse.json({ error: 'dateFrom must be before dateTo' }, { status: 400 });
    }
    if (diff > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
        { status: 400 }
      );
    }
  }

  try {
    // Fetch user's custom benchmark settings
    const benchmarkDoc = await adminDb.collection('benchmarks').doc(uid).get();
    const benchmarkData = benchmarkDoc.exists ? benchmarkDoc.data() : null;
    const metricTargets = benchmarkData?.metricTargets ?? {};

    // Effective target per metric (custom overrides system default)
    const effectiveTargets: Record<string, number> = {};
    for (const metric of Object.keys(SYSTEM_DEFAULTS)) {
      const t = metricTargets[metric];
      effectiveTargets[metric] =
        t && t.useDefault === false && t.customTarget != null
          ? t.customTarget
          : SYSTEM_DEFAULTS[metric];
    }

    // Aggregate adStats for the date range
    let statsQuery = adminDb
      .collection('adStats')
      .where('uid', '==', uid) as FirebaseFirestore.Query;

    if (dateFrom) statsQuery = statsQuery.where('date', '>=', dateFrom);
    if (dateTo) statsQuery = statsQuery.where('date', '<=', dateTo);

    const statsSnapshot = await statsQuery.get();

    if (statsSnapshot.empty) {
      return NextResponse.json({ score: null, computedAt: new Date().toISOString() });
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    statsSnapshot.forEach((doc) => {
      const d = doc.data();
      totalRevenue += d.revenue || 0;
      totalCost += d.cost || 0;
      totalImpressions += d.impressions || 0;
      totalClicks += d.clicks || 0;
    });

    const roi = computeRoi(totalRevenue, totalCost); // returns number | null
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : null;

    // Build component scores
    const components: { metric: string; score: number; weight: number }[] = [];

    if (roi != null) {
      components.push({
        metric: 'roi',
        score: ratioToScore(roi, effectiveTargets.roi),
        weight: METRIC_WEIGHTS.roi,
      });
    }
    if (ctr != null) {
      components.push({
        metric: 'ctr',
        score: ratioToScore(ctr, effectiveTargets.ctr),
        weight: METRIC_WEIGHTS.ctr,
      });
    }
    if (cpm != null) {
      components.push({
        metric: 'cpm',
        score: ratioToScore(cpm, effectiveTargets.cpm, true /* lower is better */),
        weight: METRIC_WEIGHTS.cpm,
      });
    }

    if (components.length === 0) {
      return NextResponse.json({ score: null, computedAt: new Date().toISOString() });
    }

    // Re-normalise weights in case some metrics had no data
    const totalWeight = components.reduce((s, c) => s + c.weight, 0);
    const compositeScore = Math.round(
      components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0)
    );

    return NextResponse.json({
      score: compositeScore,
      computedAt: new Date().toISOString(),
      breakdown: components.map((c) => ({ metric: c.metric, score: c.score, weight: c.weight })),
    });
  } catch (error) {
    console.error('benchmarks/score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
