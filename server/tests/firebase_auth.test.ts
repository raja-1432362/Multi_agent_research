import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeEach } from "vitest";
import { clearFirebaseCertCache, verifyFirebaseIdToken } from "../src/services/auth/firebase";

describe("Firebase ID token verifier", () => {
  beforeEach(() => clearFirebaseCertCache());

  it("verifies a valid RS256 Firebase ID token against Google x509 certs", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const projectId = "evidence-desk-demo";

    const idToken = jwt.sign(
      {
        sub: "firebase-uid-123",
        email: "raja@example.com",
        email_verified: true,
        name: "Raja Das",
      },
      privateKey,
      {
        algorithm: "RS256",
        keyid: "test-kid-1",
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        expiresIn: "1h",
      }
    );

    const mockFetch: typeof fetch = (async () =>
      new Response(JSON.stringify({ "test-kid-1": pubPem }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
      })) as typeof fetch;

    const user = await verifyFirebaseIdToken(idToken, projectId, mockFetch);
    expect(user).toEqual({
      uid: "firebase-uid-123",
      email: "raja@example.com",
      displayName: "Raja Das",
    });
  });

  it("rejects tokens with unverified email or wrong audience", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const projectId = "evidence-desk-demo";

    const unverifiedToken = jwt.sign(
      { sub: "uid-2", email: "bad@example.com", email_verified: false },
      privateKey,
      {
        algorithm: "RS256",
        keyid: "test-kid-1",
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
        expiresIn: "1h",
      }
    );

    const mockFetch: typeof fetch = (async () =>
      new Response(JSON.stringify({ "test-kid-1": pubPem }), { status: 200 })) as typeof fetch;

    await expect(verifyFirebaseIdToken(unverifiedToken, projectId, mockFetch)).rejects.toThrow(
      "Google account must have a verified email address"
    );
  });
});
