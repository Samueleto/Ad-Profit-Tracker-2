// Step 147: Token hashing utility (server-side only)

import { createHash } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
