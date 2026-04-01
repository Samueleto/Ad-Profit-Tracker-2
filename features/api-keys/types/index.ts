// Step 118: TypeScript types for apiKeys schema

export const SUPPORTED_NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;

export type NetworkId = typeof SUPPORTED_NETWORKS[number];

export interface ApiKeyDocument {
  encryptedKey: string;
  readonly networkId: NetworkId;
  readonly userId: string;
  readonly createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface NetworkStatus {
  networkId: NetworkId;
  status: 'connected' | 'not_connected';
  updatedAt: string | null; // ISO string
}

export interface SaveKeyRequest {
  networkId: NetworkId;
  key: string;
}

export interface DeleteKeyRequest {
  networkId: NetworkId;
}
