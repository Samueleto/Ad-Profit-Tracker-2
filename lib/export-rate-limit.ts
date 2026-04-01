// Shared export rate limit: 10 exports/hour shared across PDF and Excel endpoints.
// The counter is keyed by '{uid}_export_rate_limit' so one user's limit never
// bleeds into another user's budget.

const exportRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkExportRateLimit(uid: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${uid}_export_rate_limit`;
  const entry = exportRateLimitMap.get(key);
  if (!entry || now >= entry.resetAt) {
    exportRateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}
