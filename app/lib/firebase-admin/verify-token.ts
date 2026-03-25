import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./admin";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Returns the decoded token or a 401 response.
 */
export async function verifyAuthToken(
  request: Request | NextRequest
): Promise<{ token: DecodedIdToken } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      ),
    };
  }

  const idToken = authHeader.split("Bearer ")[1];

  if (!idToken) {
    return {
      error: NextResponse.json(
        { error: "Bearer token is empty" },
        { status: 401 }
      ),
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return { token: decodedToken };
  } catch (error) {
    console.error("Token verification failed:", error);
    return {
      error: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }
}
