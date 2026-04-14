import * as admin from "firebase-admin";

// ─── Credential resolution ─────────────────────────────────────────────────────

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

// Vercel stores secrets as single-line strings with literal \n.
// Replace \\n → \n so the PEM key has actual newlines.
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const privateKey = rawPrivateKey
  ? rawPrivateKey.replace(/\\n/g, "\n").trim()
  : undefined;

const credentialsValid =
  !!projectId &&
  !!clientEmail &&
  !!privateKey &&
  privateKey.startsWith("-----BEGIN") &&
  !privateKey.includes("your_private_key");

/**
 * True when all three Firebase Admin env vars are present and look valid.
 * Use this flag in health checks / diagnostic endpoints.
 */
export const adminCredentialsConfigured: boolean = credentialsValid;

// Guard against multiple initializations (Next.js hot-reload safety)
if (!admin.apps.length) {
  if (credentialsValid) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId!,
        clientEmail: clientEmail!,
        privateKey: privateKey!,
      }),
    });
  } else {
    // Build-time / preview fallback — Firestore/Auth calls will fail at runtime.
    // Check FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and
    // FIREBASE_ADMIN_PRIVATE_KEY in your Vercel project settings.
    console.error(
      "[firebase-admin] WARNING: credentials not fully configured. " +
      `projectId=${!!projectId} clientEmail=${!!clientEmail} ` +
      `privateKey=${!!privateKey} startsWithBegin=${privateKey?.startsWith("-----BEGIN")}`
    );
    admin.initializeApp({
      projectId: projectId || "placeholder-project",
    });
  }
}

// Export Auth and Firestore Admin instances
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
