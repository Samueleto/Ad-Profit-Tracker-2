// Step 150: Deployment API response types

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthResponseOk {
  status: 'healthy' | 'degraded';
  firestore: 'ok' | 'slow';
  firestoreLatencyMs: number;
  memoryMB: number;
  uptime: number;
  version: string;
}

export interface HealthResponseError {
  status: 'unhealthy';
  error: string;
}

export type HealthResponse = HealthResponseOk | HealthResponseError;

export interface ReadinessResponseReady {
  ready: true;
  checks: {
    envVars: 'ok';
    firebaseAdmin: 'ok';
  };
}

export interface ReadinessResponseNotReady {
  ready: false;
  failedCheck: string;
}

export type ReadinessResponse = ReadinessResponseReady | ReadinessResponseNotReady;

export interface DeploymentStatusResponse {
  service: string;
  revision: string;
  region: string;
  environment: string;
  uptimeSeconds: number;
  nodeVersion: string;
  deployedAt: string | null;
}

export interface ErrorResponse {
  message: string;
}

export const REQUIRED_ENV_VARS = [
  'FIREBASE_PROJECT_ID',
  'INTERNAL_SYNC_SECRET',
  'EMAIL_PROVIDER_API_KEY',
  'EMAIL_FROM_ADDRESS',
] as const;

export type RequiredEnvVar = typeof REQUIRED_ENV_VARS[number];
