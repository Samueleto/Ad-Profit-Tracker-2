import { NextResponse } from 'next/server';
import { REQUIRED_ENV_VARS } from '@/lib/deployment/types';

export async function GET() {
  const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    return NextResponse.json(
      { ready: false, failedCheck: `Missing env vars: ${missingVars.join(', ')}` },
      { status: 503 }
    );
  }

  try {
    // Check firebase-admin initialized
    const { adminDb } = await import('@/lib/firebase-admin/admin');
    if (!adminDb) throw new Error('Firebase Admin not initialized');

    return NextResponse.json({
      ready: true,
      checks: {
        envVars: 'ok',
        firebaseAdmin: 'ok',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ready: false, failedCheck: 'firebaseAdmin initialization failed' },
      { status: 503 }
    );
  }
}
