import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../services/api";
import { DEMO_WORKSPACE } from "../services/demoData";
import type { Run, Workspace } from "../types";

export default function NewResearch() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isDemo = user?.id === "demo-user";

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [collectionMode, setCollectionMode] = useState<"open_web" | "workspace_watchlist" | "hybrid">("open_web");
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState("standard");
  const [maxSources, setMaxSources] = useState(10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setWorkspaces([DEMO_WORKSPACE]);
      return;
    }
    api<Workspace[]>("/workspaces")
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, [isDemo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (isDemo) {
      nav("/research/demo-esp32");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const run = await api<Run>("/research", {
        method: "POST",
        json: {
          question,
          depth,
          maxSources,
          dateFrom,
          dateTo,
          workspaceId: workspaceId || undefined,
          collectionMode: workspaceId ? (collectionMode === "open_web" ? "hybrid" : collectionMode) : "open_web",
        },
      });
      nav(`/research/${run._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New research</h2>
      <p className="small muted" style={{ marginBottom: "1rem" }}>
        Run a general research report or attach a Competitor Workspace to check approved company sources.
      </p>

      {workspaces.length > 0 && (
        <div className="grid2" style={{ marginBottom: "0.75rem" }}>
          <label>
            Workspace watchlist (optional)
            <select
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                if (e.target.value && collectionMode === "open_web") setCollectionMode("workspace_watchlist");
                if (!e.target.value) setCollectionMode("open_web");
              }}
            >
              <option value="">None — General web & scholarly search</option>
              {workspaces.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.approvedSources.length} approved sources)
                </option>
              ))}
            </select>
          </label>
          {workspaceId && (
            <label>
              Source collection scope
              <select
                value={collectionMode}
                onChange={(e) => setCollectionMode(e.target.value as "workspace_watchlist" | "hybrid")}
              >
                <option value="workspace_watchlist">Approved Watchlist URLs & Docs Only</option>
                <option value="hybrid">Approved Watchlist + Search Within Approved Domains</option>
              </select>
            </label>
          )}
        </div>
      )}

      <label>
        Research question
        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
          minLength={10}
          maxLength={500}
          placeholder="e.g. What changed in Acme's pricing, release notes, or API documentation recently?"
        />
      </label>
      <div className="grid3">
        <label>
          Depth
          <select value={depth} onChange={(e) => setDepth(e.target.value)}>
            <option value="quick">Quick (3 queries)</option>
            <option value="standard">Standard (4 queries)</option>
            <option value="deep">Deep (6 queries, advanced search)</option>
          </select>
        </label>
        <label>
          Max sources
          <input type="number" min={3} max={30} value={maxSources} onChange={(e) => setMaxSources(Number(e.target.value))} />
        </label>
        <span />
        <label>Published from <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>Published to <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
      </div>
      <p className="muted small">Each run uses search credits and Gemini free-tier quota. Deep searches cost more credits.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Starting…" : "Start research"}</button>
    </form>
  );
}
