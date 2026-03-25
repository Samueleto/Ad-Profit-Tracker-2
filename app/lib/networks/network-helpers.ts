import { adminDb } from "@/lib/firebase-admin/admin";
import { decrypt } from "@/lib/encryption";
import { FieldValue } from "firebase-admin/firestore";
import { NetworkId } from "@/lib/constants";
import axios from "axios";

export const NETWORK_API_CONFIGS: Record<NetworkId, {
  baseUrl: string;
  statsPath: string;
  fieldSchema: Record<string, string>;
}> = {
  exoclick: {
    baseUrl: "https://api.exoclick.com/v2",
    statsPath: "/statistics/publisher",
    fieldSchema: {
      date: "string",
      impressions: "number",
      clicks: "number",
      ctr: "number",
      revenue: "number",
      ecpm: "number",
      country: "string",
      zone_id: "string",
      ad_type: "string",
    },
  },
  rollerads: {
    baseUrl: "https://api.rollerads.com/v1",
    statsPath: "/publisher/statistics",
    fieldSchema: {
      date: "string",
      impressions: "number",
      clicks: "number",
      ctr: "number",
      revenue: "number",
      ecpm: "number",
      country: "string",
      campaign_id: "string",
    },
  },
  zeydoo: {
    baseUrl: "https://api.zeydoo.com/v1",
    statsPath: "/publisher/stats",
    fieldSchema: {
      date: "string",
      impressions: "number",
      clicks: "number",
      ctr: "number",
      revenue: "number",
      ecpm: "number",
      country: "string",
      offer_id: "string",
    },
  },
  propush: {
    baseUrl: "https://app.propush.me/api",
    statsPath: "/publisher/statistics",
    fieldSchema: {
      date: "string",
      impressions: "number",
      clicks: "number",
      ctr: "number",
      revenue: "number",
      ecpm: "number",
      country: "string",
      site_id: "string",
    },
  },
};

export async function getApiKey(uid: string, networkId: NetworkId): Promise<string | null> {
  const keyDoc = await adminDb
    .collection("users")
    .doc(uid)
    .collection("apiKeys")
    .doc(networkId)
    .get();

  if (!keyDoc.exists || !keyDoc.data()?.encryptedKey) {
    return null;
  }

  return decrypt(keyDoc.data()!.encryptedKey);
}

export async function createAuditLog(
  uid: string,
  action: string,
  networkId: NetworkId,
  details?: Record<string, unknown>
) {
  await adminDb.collection("auditLogs").add({
    uid,
    action,
    networkId,
    details: details || null,
    timestamp: FieldValue.serverTimestamp(),
  });
}

export async function fetchNetworkStats(
  networkId: NetworkId,
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<unknown> {
  const config = NETWORK_API_CONFIGS[networkId];
  const response = await axios.get(`${config.baseUrl}${config.statsPath}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    params: { date_from: dateFrom, date_to: dateTo },
    timeout: 30000,
  });
  return response.data;
}

export function serializeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data();
  if (!data) return null;
  const result: Record<string, unknown> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "toDate" in value) {
      result[key] = (value as { toDate: () => Date }).toDate().toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}
