import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    const baseRef = adminDb.collection("users").doc(uid).collection("networkConfigs");
    const snapshot = networkId
      ? await baseRef.doc(networkId).get().then(d => ({ docs: d.exists ? [d] : [] }))
      : await baseRef.get();

    const statuses = snapshot.docs.map((doc) => {
      const data = doc.data()!;
      return {
        networkId: doc.id,
        circuitBreakerState: data.circuitBreakerState || "closed",
        failureCount: data.failureCount || 0,
        lastFailureAt: data.lastFailureAt?.toDate?.()?.toISOString() || null,
        isActive: data.isActive ?? false,
      };
    });

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("GET /api/errors/circuit-breaker/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
