import * as admin from "firebase-admin";

// Guard against multiple initializations
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

  // Only initialize with credentials if all required env vars are set and valid
  if (
    projectId &&
    clientEmail &&
    privateKey &&
    privateKey.startsWith("-----BEGIN") &&
    !privateKey.includes("your_private_key")
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Initialize without credentials (for build-time static rendering)
    // API routes will fail at runtime if real credentials aren't provided
    admin.initializeApp({
      projectId: projectId || "placeholder-project",
    });
  }
}

// Export Auth and Firestore Admin instances
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
