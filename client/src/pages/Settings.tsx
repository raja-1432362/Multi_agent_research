import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Settings() {
  const { user, deleteAccount } = useAuth();
  const nav = useNavigate();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card narrow">
      <h2>Settings</h2>
      <p><strong>{user?.displayName}</strong><br /><span className="muted">{user?.email}</span></p>
      <h3>Usage</h3>
      <p className="muted small">
        Runs are limited per day to protect free-tier quotas. Sources are stored as short excerpts only, never full pages.
        Search results and report text are sent to Gemini for analysis; do not research sensitive or private information on the free tier.
      </p>
      <h3>Delete my data</h3>
      <p className="muted small">Removes your account and every run, source, claim and report. This cannot be undone.</p>
      {confirm ? (
        <div className="row">
          <button className="btn danger" onClick={async () => { await deleteAccount(); nav("/"); }}>Yes, delete everything</button>
          <button className="btn ghost" onClick={() => setConfirm(false)}>Keep my account</button>
        </div>
      ) : (
        <button className="btn danger" onClick={() => setConfirm(true)}>Delete account and data</button>
      )}
    </div>
  );
}
