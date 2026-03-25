import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  let firestoreDeleted = false;
  let authDeleted = false;

  try {
    // Delete Firestore document
    await adminDb.collection("users").doc(uid).delete();
    firestoreDeleted = true;

    // Delete Firebase Auth user
    await adminAuth.deleteUser(uid);
    authDeleted = true;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    // Log inconsistency for manual cleanup
    if (firestoreDeleted && !authDeleted) {
      console.error(
        `INCONSISTENCY: Firestore user ${uid} deleted but Auth deletion failed. Manual cleanup required.`,
        error
      );
    } else if (!firestoreDeleted && authDeleted) {
      console.error(
        `INCONSISTENCY: Auth user ${uid} deleted but Firestore deletion failed. Manual cleanup required.`,
        error
      );
    }

    console.error("delete-account error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
