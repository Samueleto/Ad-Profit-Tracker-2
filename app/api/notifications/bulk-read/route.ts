import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { ids } = body; // optional array of IDs; if omitted, mark all as read

    let docsToUpdate;
    if (ids && Array.isArray(ids) && ids.length > 0) {
      docsToUpdate = await Promise.all(
        ids.map((id: string) => adminDb.collection("notifications").doc(id).get())
      );
      docsToUpdate = docsToUpdate.filter((doc) => doc.exists && doc.data()?.uid === uid);
    } else {
      const snapshot = await adminDb
        .collection("notifications")
        .where("uid", "==", uid)
        .where("isRead", "==", false)
        .get();
      docsToUpdate = snapshot.docs;
    }

    const batch = adminDb.batch();
    for (const doc of docsToUpdate) {
      batch.update(doc.ref, { isRead: true, readAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();

    return NextResponse.json({ success: true, marked: docsToUpdate.length });
  } catch (error) {
    console.error("POST /api/notifications/bulk-read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
