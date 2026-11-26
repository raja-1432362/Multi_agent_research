import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../services/api";
import { DEMO_ESP32_RUN, DEMO_SNAPSHOTS, DEMO_WORKSPACE } from "../services/demoData";
import type { Run, SourceSnapshot, SourceType, Workspace } from "../types";

export default function WorkspaceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isDemo = user?.id === "demo-user" || id?.startsWith("demo-");

  const [ws, setWs] = useState<Workspace | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>([]);
  const [tab, setTab] = useState<"watchlist" | "changes" | "reports">("watchlist");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Add competitor form
  const [compName, setCompName] = useState("");
  const [compDomain, setCompDomain] = useState("");
  const [compNotes, setCompNotes] = useState("");

  // Add source form
  const [srcLabel, setSrcLabel] = useState("");
  const [srcPublisher, setSrcPublisher] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [srcType, setSrcType] = useState<SourceType>("official_page");
  const [srcOfficial, setSrcOfficial] = useState(true);
  const [srcUploadedText, setSrcUploadedText] = useState("");

  // Run check & schedule
  const [question, setQuestion] = useState("What changed in competitor products, pricing, release notes, or documentation?");
  const [collectionMode, setCollectionMode] = useState<"workspace_watchlist" | "hybrid">("workspace_watchlist");
  const [cadence, setCadence] = useState<"manual" | "daily" | "weekly">("manual");
  const [scheduleSaved, setScheduleSaved] = useState("");

  const load = useCallback(async () => {
    if (isDemo) {
      setWs(DEMO_WORKSPACE);
      setRuns([DEMO_ESP32_RUN]);
      setSnapshots(DEMO_SNAPSHOTS);
      setCadence(DEMO_WORKSPACE.schedule.cadence);
      if (DEMO_WORKSPACE.schedule.defaultQuestion) setQuestion(DEMO_WORKSPACE.schedule.defaultQuestion);
      return;
    }
    try {
      const data = await api<{ workspace: Workspace; runs: Run[]; snapshots: SourceSnapshot[] }>(`/workspaces/${id}`);
      setWs(data.workspace);
      setRuns(data.runs);
      setSnapshots(data.snapshots);
      setCadence(data.workspace.schedule?.cadence ?? "manual");
      if (data.workspace.schedule?.defaultQuestion) {
        setQuestion(data.workspace.schedule.defaultQuestion);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workspace not found");
    }
  }, [id, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!srcLabel) setSrcLabel(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setSrcUploadedText(text.slice(0, 15000));
    };
    reader.readAsText(file);
  }

  async function addCompetitor(e: FormEvent) {
    e.preventDefault();
    if (isDemo) return setError("Demo workspace is read-only. Sign in with a real account to edit.");
    setError("");
    setBusy(true);
    try {
      const updated = await api<Workspace>(`/workspaces/${id}/competitors`, {
        method: "POST",
        json: { name: compName, domain: compDomain, notes: compNotes },
      });
      setWs(updated);
      setCompName("");
      setCompDomain("");
      setCompNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add company");
    } finally {
      setBusy(false);
    }
  }

  async function removeCompetitor(compId: string) {
    if (isDemo) return;
    try {
      setWs(await api<Workspace>(`/workspaces/${id}/competitors/${compId}`, { method: "DELETE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove company");
    }
  }

  async function addSource(e: FormEvent) {
    e.preventDefault();
    if (isDemo) return setError("Demo workspace is read-only. Sign in with a real account to edit.");
    setError("");
    setBusy(true);
    try {
      const updated = await api<Workspace>(`/workspaces/${id}/sources`, {
        method: "POST",
        json: {
          label: srcLabel,
          publisher: srcPublisher,
          url: srcType === "user_upload" ? `upload://${srcLabel}` : srcUrl,
          sourceType: srcType,
          isOfficial: srcOfficial,
          uploadedText: srcType === "user_upload" ? srcUploadedText : undefined,
        },
      });
      setWs(updated);
      setSrcLabel("");
      setSrcPublisher("");
      setSrcUrl("");
      setSrcUploadedText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add approved source");
    } finally {
      setBusy(false);
    }
  }

  async function removeSource(srcId: string) {
    if (isDemo) return;
    try {
      setWs(await api<Workspace>(`/workspaces/${id}/sources/${srcId}`, { method: "DELETE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove source");
    }
  }

  async function saveSchedule() {
    if (isDemo) return setError("Demo workspace schedule cannot be changed.");
    setError("");
    setScheduleSaved("");
    try {
      const updated = await api<Workspace>(`/workspaces/${id}/schedule`, {
        method: "PATCH",
        json: { cadence, defaultQuestion: question },
      });
      setWs(updated);
      setScheduleSaved("Schedule updated.");
      setTimeout(() => setScheduleSaved(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save schedule");
    }
  }

  async function runCheck(e: FormEvent) {
    e.preventDefault();
    if (isDemo) {
      nav("/research/demo-esp32");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const run = await api<Run>(`/workspaces/${id}/run`, {
        method: "POST",
        json: { question, depth: "standard", collectionMode },
      });
      nav(`/research/${run._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start check");
      setBusy(false);
    }
  }

  async function deleteWorkspace() {
    if (isDemo) return;
    if (!confirm("Delete this workspace and all its snapshots and reports? This cannot be undone.")) return;
    try {
      await api(`/workspaces/${id}`, { method: "DELETE" });
      nav("/workspaces");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete workspace");
    }
  }

  if (error && !ws) return <p className="error center">{error}</p>;
  if (!ws) return <p className="center muted">Loading workspace…</p>;

  return (
    <div className="page">
      <div className="run-header">
        <Link to="/workspaces" className="back-link">← Back to Workspaces</Link>
        <div className="row between wrap" style={{ marginTop: "0.4rem" }}>
          <div>
            <h1 className="run-title" style={{ marginBottom: "0.2rem" }}>{ws.name}</h1>
            {ws.description && <p className="muted small">{ws.description}</p>}
          </div>
          {!isDemo && (
            <button className="btn small danger" onClick={deleteWorkspace}>Delete workspace</button>
          )}
        </div>
      </div>

      {error && <p className="error" role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}

      {/* RUN COMPETITOR CHECK PANEL */}
      <form className="card" onSubmit={runCheck} style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Run Competitor & Market Check</h3>
        <label>
          What do you want to check?
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            minLength={10}
            maxLength={500}
            placeholder="e.g. Did Acme change its Enterprise pricing or API limits recently?"
          />
        </label>
        <div className="grid2" style={{ marginTop: "0.6rem" }}>
          <label>
            Source collection scope
            <select
              value={collectionMode}
              onChange={(e) => setCollectionMode(e.target.value as "workspace_watchlist" | "hybrid")}
            >
              <option value="workspace_watchlist">Approved Watchlist URLs & Feeds Only (Strict)</option>
              <option value="hybrid">Watchlist URLs + Search Within Approved Domains</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn small" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Starting Check…" : "▶ Run Check Now"}
            </button>
          </div>
        </div>
      </form>

      {/* TABS */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.6rem", marginBottom: "1.25rem", overflowX: "auto" }}>
        <button className={`btn small ${tab === "watchlist" ? "" : "ghost"}`} onClick={() => setTab("watchlist")}>
          Watchlist & Schedule ({ws.approvedSources.length})
        </button>
        <button className={`btn small ${tab === "changes" ? "" : "ghost"}`} onClick={() => setTab("changes")}>
          What Changed ({snapshots.length})
        </button>
        <button className={`btn small ${tab === "reports" ? "" : "ghost"}`} onClick={() => setTab("reports")}>
          Reports ({runs.length})
        </button>
      </div>

      {tab === "watchlist" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* COMPANIES */}
          <section className="card">
            <h3>Tracked Companies ({ws.competitors.length})</h3>
            <p className="small muted" style={{ marginBottom: "0.75rem" }}>
              Add competitor companies and their official domain (e.g., stripe.com). No personal profiles are collected.
            </p>
            {ws.competitors.length > 0 && (
              <ul className="runlist" style={{ marginBottom: "1rem" }}>
                {ws.competitors.map((c) => (
                  <li key={c._id} style={{ padding: "0.7rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <div>
                      <strong>{c.name}</strong> {c.domain && <span className="cite static">{c.domain}</span>}
                      {c.notes && <div className="small muted">{c.notes}</div>}
                    </div>
                    {!isDemo && (
                      <button className="btn small danger" type="button" onClick={() => removeCompetitor(c._id)}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addCompetitor} className="grid3">
              <label>
                Company name
                <input value={compName} onChange={(e) => setCompName(e.target.value)} required placeholder="e.g. Linear" />
              </label>
              <label>
                Official domain
                <input value={compDomain} onChange={(e) => setCompDomain(e.target.value)} placeholder="e.g. linear.app" />
              </label>
              <label>
                Focus notes (optional)
                <input value={compNotes} onChange={(e) => setCompNotes(e.target.value)} placeholder="e.g. Pricing & changelog" />
              </label>
              <div>
                <button className="btn small ghost" disabled={busy || !compName.trim()}>+ Add Company</button>
              </div>
            </form>
          </section>

          {/* APPROVED PUBLIC SOURCES */}
          <section className="card">
            <h3>Approved Public Sources ({ws.approvedSources.length})</h3>
            <p className="small muted" style={{ marginBottom: "0.75rem" }}>
              Only approved public URLs, RSS feeds, docs, release notes, or uploaded public documents are collected. Logins, CAPTCHAs, and paywalls are never bypassed.
            </p>

            {ws.approvedSources.length === 0 ? (
              <p className="small muted" style={{ marginBottom: "1rem" }}>No approved sources added yet. Add a public page or upload a document below.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.2rem" }}>
                {ws.approvedSources.map((s) => (
                  <div key={s._id} style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        <strong>{s.label}</strong>
                        <span className={`badge ${s.isOfficial ? "supported" : "mixed"}`}>
                          {s.isOfficial ? "Official" : "External"}
                        </span>
                        <span className="cite static">{s.sourceType.replace("_", " ")}</span>
                      </div>
                      <div className="small muted" style={{ wordBreak: "break-all", marginTop: "0.2rem" }}>{s.url}</div>
                    </div>
                    {!isDemo && (
                      <button className="btn small danger" type="button" onClick={() => removeSource(s._id)}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addSource}>
              <div className="grid2">
                <label>
                  Source label
                  <input value={srcLabel} onChange={(e) => setSrcLabel(e.target.value)} required placeholder="e.g. Acme Pricing Page" />
                </label>
                <label>
                  Source type
                  <select value={srcType} onChange={(e) => setSrcType(e.target.value as SourceType)}>
                    <option value="official_page">Official Company / Product Page</option>
                    <option value="documentation">Public Documentation</option>
                    <option value="release_notes">Release Notes / Changelog</option>
                    <option value="company_blog">Official Company Blog / Press Release</option>
                    <option value="rss_feed">RSS / Atom Feed</option>
                    <option value="news">Public News / Analyst Article</option>
                    <option value="user_upload">Upload Public Document (.txt / .md / text)</option>
                  </select>
                </label>
              </div>

              {srcType === "user_upload" ? (
                <div style={{ marginTop: "0.6rem" }}>
                  <label>
                    Choose text/markdown file (or paste below)
                    <input type="file" accept=".txt,.md,.csv,.json" onChange={handleFileUpload} />
                  </label>
                  <label>
                    Document content
                    <textarea
                      rows={4}
                      value={srcUploadedText}
                      onChange={(e) => setSrcUploadedText(e.target.value)}
                      required
                      placeholder="Paste public release notes, product announcement, or pricing table text..."
                    />
                  </label>
                </div>
              ) : (
                <div className="grid2" style={{ marginTop: "0.6rem" }}>
                  <label>
                    Public URL
                    <input
                      type="url"
                      value={srcUrl}
                      onChange={(e) => setSrcUrl(e.target.value)}
                      required
                      placeholder="https://example.com/pricing"
                    />
                  </label>
                  <label>
                    Publisher (optional)
                    <input value={srcPublisher} onChange={(e) => setSrcPublisher(e.target.value)} placeholder="e.g. Acme Inc." />
                  </label>
                </div>
              )}

              <div className="row between wrap" style={{ marginTop: "0.8rem" }}>
                <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" checked={srcOfficial} onChange={(e) => setSrcOfficial(e.target.checked)} style={{ width: "auto" }} />
                  <span>Mark as an official company source</span>
                </label>
                <button className="btn small" disabled={busy}>+ Add Approved Source</button>
              </div>
            </form>
          </section>

          {/* SCHEDULE */}
          <section className="card">
            <h3>Recurring Checks</h3>
            <p className="small muted" style={{ marginBottom: "0.75rem" }}>
              Optionally check approved sources automatically on a schedule (subject to daily quota limits).
            </p>
            <div className="grid2">
              <label>
                Check frequency
                <select value={cadence} onChange={(e) => setCadence(e.target.value as "manual" | "daily" | "weekly")}>
                  <option value="manual">Manual only</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem" }}>
                <button type="button" className="btn small ghost" onClick={saveSchedule}>Save Schedule</button>
                {scheduleSaved && <span className="small" style={{ color: "var(--ok)" }}>{scheduleSaved}</span>}
              </div>
            </div>
            {ws.schedule?.nextRunAt && cadence !== "manual" && (
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                Next scheduled check: {new Date(ws.schedule.nextRunAt).toLocaleString()}
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "changes" && (
        <section className="card">
          <h3>Source Snapshot & Change History</h3>
          <p className="small muted" style={{ marginBottom: "1rem" }}>
            Compares newly collected snapshots against earlier snapshots. Failed or blocked checks are shown explicitly so stale data is never presented as fresh.
          </p>
          {snapshots.length === 0 ? (
            <div className="empty">
              <p>No snapshots recorded yet.</p>
              <p className="small muted">Run a check above to capture your baseline source snapshots.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {snapshots.map((snap) => (
                <div key={snap._id} style={{ padding: "1rem", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)" }}>
                  <div className="row between wrap" style={{ marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{snap.title || snap.url}</strong>
                      <span className={`badge ${snap.changeStatus === "changed" ? "mixed" : snap.fetchStatus !== "ok" ? "contradicted" : "supported"}`}>
                        {snap.changeStatus.replace("_", " ")}
                      </span>
                      {snap.fetchStatus !== "ok" && (
                        <span className="badge contradicted">{snap.fetchStatus}</span>
                      )}
                    </div>
                    <span className="small muted">
                      {snap.publishedAt ? `Published: ${snap.publishedAt}` : "Published: Unknown"} · Retrieved: {new Date(snap.retrievedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="small" style={{ color: "var(--ink-2)" }}>{snap.diffSummary || snap.fetchError}</p>
                  {(snap.addedLines.length > 0 || snap.removedLines.length > 0) && (
                    <details style={{ marginTop: "0.5rem" }}>
                      <summary className="small" style={{ cursor: "pointer", color: "var(--peri-2)" }}>
                        Inspect text changes ({snap.addedLines.length} added, {snap.removedLines.length} removed)
                      </summary>
                      <div style={{ marginTop: "0.5rem", fontSize: "0.84rem", fontFamily: "var(--mono)" }}>
                        {snap.addedLines.map((l, idx) => (
                          <div key={`a-${idx}`} style={{ color: "var(--ok)", marginBottom: "0.25rem" }}>+ {l}</div>
                        ))}
                        {snap.removedLines.map((l, idx) => (
                          <div key={`r-${idx}`} style={{ color: "var(--bad)", marginBottom: "0.25rem" }}>- {l}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "reports" && (
        <section>
          {runs.length === 0 ? (
            <div className="empty">
              <p>No workspace reports yet.</p>
              <p className="small muted">Click "Run Check Now" above to generate your first evidence-backed briefing.</p>
            </div>
          ) : (
            <ul className="runlist">
              {runs.map((r) => (
                <li key={r._id}>
                  <Link to={`/research/${r._id}`}>
                    <span className="q">{r.question}</span>
                    <span className="meta">
                      <span className={`badge ${r.status}`}>{r.status}</span>
                      <span>{r.triggerType ?? "manual"}</span>
                      {r.sourceCount > 0 && <span>{r.sourceCount} sources</span>}
                      {typeof r.metrics?.snapshotsChanged === "number" && r.metrics.snapshotsChanged > 0 && (
                        <span className="badge mixed">{r.metrics.snapshotsChanged} changed</span>
                      )}
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
