import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin/admin';
import { verifyAuthToken } from '@/lib/firebase-admin/verify-token';

// Rate limit: 20 preference-update actions/hour per uid (GET is not rate-limited)
const preferencesRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkPreferencesRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = preferencesRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    preferencesRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

const VALID_PREFERENCE_KEYS = new Set([
  'syncSuccess', 'syncFailure', 'reconciliationAlert', 'anomalyDetected',
  'lowBalance', 'weeklyDigest', 'monthlyReport', 'systemMaintenance',
]);

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const preferences = userDoc.data()?.notificationPreferences ?? {};
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('GET /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const rl = checkPreferencesRateLimit(uid);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many preference updates. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 3600) } }
    );
  }

  try {
    const body = await request.json();

    // Validate: only allow known preference keys with boolean values
    const updates: Record<string, boolean> = {};
    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (!VALID_PREFERENCE_KEYS.has(key)) {
        return NextResponse.json(
          { error: `Unknown preference key: ${key}` },
          { status: 400 }
        );
      }
      if (typeof value !== 'boolean') {
        return NextResponse.json(
          { error: `Preference value for '${key}' must be a boolean` },
          { status: 400 }
        );
      }
      updates[`notificationPreferences.${key}`] = value;
      changedKeys.push(key);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No preferences provided' }, { status: 400 });
    }

    await adminDb.collection('users').doc(uid).update(updates);

    // Audit log — fire-and-forget
    adminDb.collection('auditLogs').add({
      userId: uid,
      action: 'preferences_updated',
      resourceType: 'notification',
      metadata: { changedPreferenceTypes: changedKeys, updates: body },
      status: 'success',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => console.error('audit log write failed:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
