import { getAuth } from 'firebase-admin/auth';
import { adminApp } from './firebase-admin';

/**
 * Verifies a Firebase ID token from the Authorization header.
 * Returns the user's UID if valid, or null if verification fails.
 * 
 * Usage in API routes:
 * ```ts
 * const uid = await verifyToken(req);
 * if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * ```
 */
export async function verifyToken(req: Request): Promise<string | null> {
  if (!adminApp) {
    console.warn('Firebase Admin not initialized — skipping token verification.');
    return null;
  }

  const auth = getAuth(adminApp);
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
