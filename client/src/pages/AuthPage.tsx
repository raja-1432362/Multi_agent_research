import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register, loginDemo } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
        setError("Backend API is not hosted on this static Vercel URL. You can connect your backend with VITE_API_URL or click 'Instant Demo Mode' below to explore right now!");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{mode === "login" ? "Sign in" : "Create your account"}</h2>
      {mode === "register" && (
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></label>
      )}
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : 1} />
        {mode === "register" && <span className="hint">At least 8 characters</span>}
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>

      <div style={{ margin: "1.2rem 0 0.8rem", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: "0.8rem" }}>
          <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255,255,255,0.15)" }} />
          <span style={{ padding: "0 10px", fontSize: "0.8rem", opacity: 0.7 }}>OR</span>
          <hr style={{ flex: 1, border: "none", borderTop: "1px solid rgba(255,255,255,0.15)" }} />
        </div>
        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => {
            loginDemo();
            nav("/dashboard");
          }}
        >
          ⚡ Explore Instant Demo Mode
        </button>
      </div>

      <p className="muted small">
        {mode === "login" ? <>No account? <Link to="/register">Create one</Link></> : <>Already registered? <Link to="/login">Sign in</Link></>}
      </p>
    </form>
  );
}
