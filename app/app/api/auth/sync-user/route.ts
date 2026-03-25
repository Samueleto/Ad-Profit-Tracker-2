import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Determine auth provider
      const signInProvider = token.firebase?.sign_in_provider || "password";
      const authProvider = signInProvider === "google.com" ? "google" : "email";

      // Create new user document
      await userRef.set({
        uid,
        email: token.email || "",
        displayName: token.name || null,
        photoURL: token.picture || null,
        authProvider,
        role: "user",
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
        preferences: {
          defaultDateRange: "last_7_days",
          timezone: "UTC",
        },
      });
    } else {
      // Only update lastLoginAt
      await userRef.update({
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    }

    // Fetch and return the user document
    const updatedDoc = await userRef.get();
    const data = updatedDoc.data()!;

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
    });
  } catch (error) {
    console.error("sync-user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
