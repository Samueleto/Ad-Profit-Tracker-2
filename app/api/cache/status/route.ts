import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("rawResponses")
      .get();

    const entries = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        // doc.id is the networkId (rawResponses are stored as .doc(networkId))
        networkId: (data.networkId as string) || doc.id,
        fetchedAt: data.fetchedAt?.toDate?.()?.toISOString() || null,
        dateFrom: data.dateFrom,
        dateTo: data.dateTo,
        hasData: !!data.data,
      };
    });

    return NextResponse.json({
      cacheEntries: entries,
      total: entries.length,
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/cache/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
