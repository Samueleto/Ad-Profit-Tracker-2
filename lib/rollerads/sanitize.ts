// Step 123: Sanitize raw response to remove sensitive fields

const SENSITIVE_PATTERNS = /key|token|secret|authorization/i;

export function sanitizeRawResponse(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SENSITIVE_PATTERNS.test(key)) {
      result[key] = value;
    }
  }
  return result;
}
