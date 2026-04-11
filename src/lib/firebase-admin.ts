import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';

/**
 * Firebase Admin SDK initialization for server-side operations.
 * Requires FIREBASE_SERVICE_ACCOUNT env var with JSON-stringified credentials.
 */
function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!serviceAccountJson) {
    console.warn(
      'FIREBASE_SERVICE_ACCOUNT env var not set. Server-side Firebase operations will be unavailable.'
    );
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    return null;
  }
}

export const adminApp = getAdminApp();
