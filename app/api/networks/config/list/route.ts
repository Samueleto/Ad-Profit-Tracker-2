import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const snapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("networkConfigs")
      .orderBy("displayOrder", "asc")
      .get();

    const configs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ configs });
  } catch (error) {
    console.error("GET /api/networks/config/list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
