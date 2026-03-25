// Step 129: In-memory rate limiter (sliding window)

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export async function checkRateLimit(
  uid: string,
  action: string,
  maxPerHour: number
): Promise<boolean> {
  const key = `${uid}:${action}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour in ms

  const entry = rateLimitMap.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the window
  const validTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxPerHour) {
    rateLimitMap.set(key, { timestamps: validTimestamps });
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(key, { timestamps: validTimestamps });
  return true;
}

export function getRateLimitRemaining(
  uid: string,
  action: string,
  maxPerHour: number
): number {
  const key = `${uid}:${action}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  const entry = rateLimitMap.get(key);
  if (!entry) return maxPerHour;

  const validTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
  return Math.max(0, maxPerHour - validTimestamps.length);
}
