import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// Strip credential-like patterns from error messages
const CREDENTIAL_RE = /key=\S+|token=\S+|secret=\S+|password=\S+/gi;

function sanitizeErrorMessage(msg: unknown): string | null {
  if (typeof msg !== "string") return null;
  return msg.replace(CREDENTIAL_RE, "[REDACTED]").slice(0, 500);
}

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

    let query = adminDb
      .collection("networkConfigs")
      .where("userId", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    const snapshot = await query.get();

    const retryStates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        networkId: data.networkId,
        retryAttempts: data.retryAttempts || 0,
        lastSyncError: sanitizeErrorMessage(data.lastSyncError),
        lastSyncAt: data.lastSyncAt?.toDate?.()?.toISOString() || null,
        isActive: data.isActive ?? false,
      };
    });

    return NextResponse.json({ retryStates });
  } catch (error) {
    console.error("GET /api/errors/retry-state error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
