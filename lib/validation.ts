// Step 118: Shared validation helpers

import { SUPPORTED_NETWORKS } from '@/features/api-keys/types';
import type { NetworkId } from '@/features/api-keys/types';

export function isValidNetworkId(id: string): id is NetworkId {
  return (SUPPORTED_NETWORKS as readonly string[]).includes(id);
}
