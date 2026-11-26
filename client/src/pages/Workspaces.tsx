import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../services/api";
import { DEMO_WORKSPACE } from "../services/demoData";
import type { Workspace } from "../types";

export default function Workspaces() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isDemo = user?.id === "demo-user";

  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (isDemo) {
      setWorkspaces([DEMO_WORKSPACE]);
      return;
    }
    try {
      setWorkspaces(await api<Workspace[]>("/workspaces"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspaces");
      setWorkspaces([]);
    }
  }

  useEffect(() => {
    void load();
  }, [isDemo]);

  async function createWorkspace(e: FormEvent) {
    e.preventDefault();
    if (isDemo) {
      setError("Creating new workspaces requires a signed-in backend account. Explore the Sample Demo Workspace below.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const ws = await api<Workspace>("/workspaces", {
        method: "POST",
        json: { name, description },
      });
      setName("");
      setDescription("");
      nav(`/workspaces/${ws._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: "1rem" }}>
        <div>
          <h2>Competitor & Market Workspaces</h2>
          <p className="muted small">
            Group companies, approved public URLs, release notes, and recurring checks in one isolated workspace.
          </p>
        </div>
        <Link to="/new" className="btn small ghost">One-time research</Link>
      </div>

      {isDemo && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <strong>Demo Mode:</strong> Showing clearly labeled sample workspace data. Sign in with a real account to save live watchlists.
        </div>
      )}

      <form className="card" onSubmit={createWorkspace} style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>Create a workspace</h3>
        <div className="grid2">
          <label>
            Workspace name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. CRM Pricing & Release Watch"
            />
          </label>
          <label>
            What are you tracking? (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="e.g. Track pricing tiers, changelogs, and docs for top 3 competitors"
            />
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn small" disabled={busy || !name.trim()} style={{ marginTop: "0.6rem" }}>
          {busy ? "Creating…" : "+ Create Workspace"}
        </button>
      </form>

      {!workspaces ? (
        <p className="center muted">Loading workspaces…</p>
      ) : workspaces.length === 0 ? (
        <div className="empty">
          <p>No competitor workspaces yet.</p>
          <p className="small muted">Create a workspace above to add companies and approved public sources to monitor.</p>
        </div>
      ) : (
        <ul className="runlist">
          {workspaces.map((ws) => (
            <li key={ws._id}>
              <Link to={`/workspaces/${ws._id}`}>
                <span className="q">{ws.name}</span>
                {ws.description && <span className="small muted">{ws.description}</span>}
                <span className="meta">
                  <span className="badge completed">{ws.competitors.length} company / companies</span>
                  <span>{ws.approvedSources.length} approved source(s)</span>
                  <span>Schedule: {ws.schedule?.cadence ?? "manual"}</span>
                  {ws.schedule?.lastRunAt && <span>Last checked {new Date(ws.schedule.lastRunAt).toLocaleDateString()}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
