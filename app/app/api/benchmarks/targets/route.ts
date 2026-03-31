import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';

// In-memory rate limit: 20 updates per hour per uid
const patchRateLimit = new Map<string, { count: number; resetAt: number }>();

const SYSTEM_DEFAULTS: Record<string, number> = {
  roi: 10,
  ctr: 2,
  cpm: 1.5,
  revenue: 1000,
  cost: 500,
  impressions: 100000,
  clicks: 2000,
};

const METRIC_UNITS: Record<string, string> = {
  roi: '%',
  ctr: '%',
  cpm: 'USD',
  revenue: 'USD',
  cost: 'USD',
  impressions: 'count',
  clicks: 'count',
};

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const benchmarkDoc = await adminDb.collection('benchmarks').doc(uid).get();
    const data = benchmarkDoc.exists ? benchmarkDoc.data() : null;

    const historicalWindowDays = data?.historicalWindowDays ?? 30;
    const metricTargets = data?.metricTargets ?? {};

    const metricsResponse = Object.keys(SYSTEM_DEFAULTS).map(metric => {
      const target = metricTargets[metric];
      const customTarget = target?.customTarget ?? null;
      const useDefault = target?.useDefault ?? true;
      const effectiveTarget = !useDefault && customTarget != null ? customTarget : SYSTEM_DEFAULTS[metric];

      return {
        metric,
        customTarget,
        useDefault,
        effectiveTarget,
        systemDefault: SYSTEM_DEFAULTS[metric],
        unit: METRIC_UNITS[metric] ?? '',
        isCustom: !useDefault && customTarget != null,
        updatedAt: target?.updatedAt ?? null,
      };
    });

    return NextResponse.json({
      historicalWindowDays,
      metricTargets: metricsResponse,
      lastUpdatedAt: data?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('benchmarks/targets GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const VALID_METRICS = new Set(['roi', 'ctr', 'cpm', 'revenue', 'cost', 'impressions', 'clicks']);

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 20 updates per hour
  const now = Date.now();
  const entry = patchRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 20) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many updates, please wait before saving again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    patchRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    const prevDoc = await adminDb.collection('benchmarks').doc(uid).get();
    const prevData = prevDoc.exists ? prevDoc.data() : null;

    let prevHistoricalWindowDays = prevData?.historicalWindowDays;
    let newHistoricalWindowDays: number | undefined;

    if (body.historicalWindowDays !== undefined) {
      const days = Number(body.historicalWindowDays);
      if (!Number.isInteger(days) || days < 7 || days > 365) {
        return NextResponse.json({ error: 'historicalWindowDays must be between 7 and 365' }, { status: 400 });
      }
      updateData.historicalWindowDays = days;
      newHistoricalWindowDays = days;
    }

    const changedMetrics: Record<string, unknown> = {};

    if (body.metricTargets) {
      for (const [metric, target] of Object.entries(body.metricTargets)) {
        // Validate metric key against allowlist
        if (!VALID_METRICS.has(metric)) continue;
        const t = target as { customTarget?: number | null; useDefault?: boolean };
        if (t.customTarget !== undefined) {
          // Validate: must be null or a non-negative number
          if (t.customTarget !== null) {
            const v = Number(t.customTarget);
            if (isNaN(v) || v < 0) {
              return NextResponse.json({ error: `customTarget for ${metric} must be a non-negative number` }, { status: 400 });
            }
            updateData[`metricTargets.${metric}.customTarget`] = v;
          } else {
            updateData[`metricTargets.${metric}.customTarget`] = null;
          }
          updateData[`metricTargets.${metric}.updatedAt`] = FieldValue.serverTimestamp();
          changedMetrics[metric] = { customTarget: t.customTarget };
        }
        if (t.useDefault !== undefined) {
          if (typeof t.useDefault !== 'boolean') {
            return NextResponse.json({ error: `useDefault for ${metric} must be a boolean` }, { status: 400 });
          }
          updateData[`metricTargets.${metric}.useDefault`] = t.useDefault;
          changedMetrics[metric] = { ...(changedMetrics[metric] as Record<string, unknown> ?? {}), useDefault: t.useDefault };
        }
      }
    }

    await adminDb.collection('benchmarks').doc(uid).set(
      { userId: uid, ...updateData },
      { merge: true }
    );

    // Audit log — fire-and-forget, includes userId, changed metrics, before/after historicalWindowDays
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'benchmark_settings_updated',
      metadata: {
        changedMetrics,
        historicalWindowDays: newHistoricalWindowDays !== undefined
          ? { before: prevHistoricalWindowDays, after: newHistoricalWindowDays }
          : undefined,
      },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error('Audit log write failed:', err));

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('benchmarks/targets PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
