import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { HttpError } from "../../middleware/error";

const CERT_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

export function clearFirebaseCertCache() {
  cachedCerts = null;
}

async function getGoogleCerts(fetchFn: typeof fetch = fetch): Promise<Record<string, string>> {
  if (cachedCerts && cachedCerts.expiresAt > Date.now()) {
    return cachedCerts.certs;
  }
  const res = await fetchFn(CERT_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, "Failed to fetch Firebase public keys");

  const cc = res.headers.get("cache-control") ?? "";
  const maxAgeMatch = /max-age=(\d+)/i.exec(cc);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600_000;
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * Verifies a Firebase ID token using Google's official public x509 certificates
 * per https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectIdOverride?: string,
  fetchFn: typeof fetch = fetch
): Promise<VerifiedFirebaseUser> {
  const projectId = projectIdOverride || env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new HttpError(
      503,
      "Google sign-in is not configured on the server yet (missing FIREBASE_PROJECT_ID)."
    );
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded !== "object" || typeof decoded.header !== "object") {
    throw new HttpError(401, "Invalid Firebase ID token");
  }
  const { kid, alg } = decoded.header as { kid?: string; alg?: string };
  if (alg !== "RS256" || !kid) {
    throw new HttpError(401, "Invalid Firebase token header");
  }

  const certs = await getGoogleCerts(fetchFn);
  const cert = certs[kid];
  if (!cert) {
    // Key might have rotated; refresh once
    clearFirebaseCertCache();
    const fresh = await getGoogleCerts(fetchFn);
    if (!fresh[kid]) throw new HttpError(401, "Firebase signing key not found");
  }
  const signingCert = (await getGoogleCerts(fetchFn))[kid];

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, signingCert, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Firebase session token is invalid or expired");
  }

  const uid = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase().trim() : "";
  const emailVerified = payload.email_verified === true;
  if (!uid || !email || !emailVerified) {
    throw new HttpError(401, "Google account must have a verified email address");
  }

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  const displayName = (rawName || email.split("@")[0] || "User").slice(0, 60);

  return { uid, email, displayName };
}
