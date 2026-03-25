import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userDoc.data()!;

    return NextResponse.json({
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      authProvider: data.authProvider,
      role: data.role,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString() || null,
      preferences: data.preferences,
      onboardingCompletedAt: data.onboardingCompletedAt?.toDate?.()?.toISOString() || null,
      onboardingSkipped: data.onboardingSkipped || false,
    });
  } catch (error) {
    console.error("get-user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
