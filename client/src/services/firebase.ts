import { getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
}

export async function signInWithGoogleFirebase(): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Google sign-in is not configured yet. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID to your client environment variables."
    );
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    return await result.user.getIdToken();
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Google sign-in popup was closed before finishing.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Popups are blocked by your browser. Please allow popups for this site and try again.");
    }
    throw err instanceof Error ? err : new Error("Google sign-in failed");
  }
}
