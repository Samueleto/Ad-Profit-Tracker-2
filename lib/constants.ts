// Supported ad networks
export const SUPPORTED_NETWORKS = ["exoclick", "rollerads", "zeydoo", "propush"] as const;
export type NetworkId = typeof SUPPORTED_NETWORKS[number];

export function isValidNetworkId(id: string): id is NetworkId {
  return SUPPORTED_NETWORKS.includes(id as NetworkId);
}
