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

// RFC 5322 simplified email validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ('error' in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data() ?? {};
    const preferences = userData.notificationPreferences ?? {};

    // Build emailAlerts map expected by EmailAlertPreferencesSection
    // Each preference key maps to { emailEnabled: boolean }
    const emailAlerts: Record<string, { emailEnabled: boolean }> = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (typeof value === 'boolean') {
        emailAlerts[key] = { emailEnabled: value };
      }
    }

    return NextResponse.json({
      preferences,
      emailAlerts,
      // Flatten convenience fields for the email alerts section
      alertDeliveryEmail: preferences.alertDeliveryEmail ?? null,
      lastTestEmailSentAt: userData.lastTestEmailSentAt?.toDate?.()?.toISOString() ?? null,
      smtpOverride: userData.smtpOverride ?? '',
    });
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
    // Special case: 'alertDeliveryEmail' is allowed as a string (RFC 5322, ≤254 chars)
    const updates: Record<string, boolean | string> = {};
    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'alertDeliveryEmail') {
        if (typeof value !== 'string') {
          return NextResponse.json(
            { error: 'alertDeliveryEmail must be a string' },
            { status: 400 }
          );
        }
        if (value.length > EMAIL_MAX_LENGTH) {
          return NextResponse.json(
            { error: `alertDeliveryEmail must be ${EMAIL_MAX_LENGTH} characters or fewer` },
            { status: 400 }
          );
        }
        if (!EMAIL_RE.test(value)) {
          return NextResponse.json(
            { error: 'alertDeliveryEmail must be a valid email address (RFC 5322)' },
            { status: 400 }
          );
        }
        updates['notificationPreferences.alertDeliveryEmail'] = value.trim();
        changedKeys.push(key);
        continue;
      }
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
