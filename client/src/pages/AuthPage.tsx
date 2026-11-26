import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, loginWithGoogle, register, loginDemo } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      nav("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("405") || msg.includes("404")) {
        setError("Backend API is not connected to this URL. Set VITE_API_URL or try Instant Demo Mode below.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true);
    setError("");
    try {
      await loginWithGoogle();
      nav("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  }

  const anyBusy = busy || googleBusy;

  return (
    <div className="auth-shell">
      <form className="card narrow auth-card" onSubmit={submit}>
        <div style={{ display: "grid", gap: "0.3rem" }}>
          <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
          <p className="small muted">
            {mode === "login"
              ? "Access your competitor watchlists and verified research reports."
              : "Start monitoring approved public sources with evidence."}
          </p>
        </div>

        <button
          type="button"
          className="btn-google"
          disabled={anyBusy}
          onClick={handleGoogle}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          <span>{googleBusy ? "Connecting Google…" : "Continue with Google"}</span>
        </button>

        <div className="auth-divider">
          <hr />
          <span>OR</span>
          <hr />
        </div>

        {mode === "register" && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && <span className="hint">At least 8 characters</span>}
        </label>

        {error && <p className="error auth-error" role="alert">{error}</p>}

        <button className="btn auth-submit" disabled={anyBusy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div className="auth-divider">
          <hr />
          <span>DEMO</span>
          <hr />
        </div>

        <button
          type="button"
          className="btn ghost auth-submit"
          disabled={anyBusy}
          onClick={() => {
            loginDemo();
            nav("/dashboard");
          }}
        >
          ⚡ Explore Instant Demo Mode
        </button>

        <p className="muted small" style={{ textAlign: "center" }}>
          {mode === "login" ? (
            <>No account? <Link to="/register">Create one</Link></>
          ) : (
            <>Already registered? <Link to="/login">Sign in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
