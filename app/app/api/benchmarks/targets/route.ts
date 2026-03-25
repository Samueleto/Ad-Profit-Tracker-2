import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';
import { FieldValue } from 'firebase-admin/firestore';

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

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;

  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.historicalWindowDays !== undefined) {
      const days = Number(body.historicalWindowDays);
      if (days < 7 || days > 365) {
        return NextResponse.json({ error: 'historicalWindowDays must be between 7 and 365' }, { status: 400 });
      }
      updateData.historicalWindowDays = days;
    }

    if (body.metricTargets) {
      for (const [metric, target] of Object.entries(body.metricTargets)) {
        const t = target as { customTarget?: number | null; useDefault?: boolean };
        if (t.customTarget !== undefined) {
          updateData[`metricTargets.${metric}.customTarget`] = t.customTarget;
          updateData[`metricTargets.${metric}.updatedAt`] = FieldValue.serverTimestamp();
        }
        if (t.useDefault !== undefined) {
          updateData[`metricTargets.${metric}.useDefault`] = t.useDefault;
        }
      }
    }

    await adminDb.collection('benchmarks').doc(uid).set(
      { userId: uid, ...updateData },
      { merge: true }
    );

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('benchmarks/targets PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
