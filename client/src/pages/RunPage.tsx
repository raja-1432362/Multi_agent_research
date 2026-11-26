import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadApiFile } from "../services/api";
import CitedText from "../components/CitedText";
import EvidenceGraph from "../components/EvidenceGraph";
import CitationExporter from "../components/CitationExporter";
import ContradictionMatrix from "../components/ContradictionMatrix";
import CrossExamineChat from "../components/CrossExamineChat";
import { Claim, ClaimStatus, Report, Run, RunEvent, Source, STAGES, TERMINAL } from "../types";
import {
  DEMO_ESP32_RUN,
  DEMO_ESP32_REPORT,
  DEMO_ESP32_CLAIMS,
  DEMO_ESP32_SOURCES,
  DEMO_ESP32_EVENTS,
} from "../services/demoData";

function plainClaimStatus(status: ClaimStatus): string {
  if (status === "supported") return "Supported";
  if (status === "contradicted") return "Contradicted";
  if (status === "mixed") return "Contradicted / Mixed";
  return "Not enough evidence";
}

export default function RunPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"report" | "graph" | "contradictions" | "chat" | "citations">("report");
  const [reviewingClaimId, setReviewingClaimId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewCorrectedText, setReviewCorrectedText] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const loadedResult = useRef(false);

  const refresh = useCallback(async () => {
    if (id?.startsWith("demo-")) {
      setRun(DEMO_ESP32_RUN);
      setEvents(DEMO_ESP32_EVENTS);
      setSources(DEMO_ESP32_SOURCES);
      setReport(DEMO_ESP32_REPORT);
      setClaims(DEMO_ESP32_CLAIMS);
      return DEMO_ESP32_RUN;
    }

    try {
      const r = await api<Run>(`/research/${id}`);
      setRun(r);
      setEvents(await api<RunEvent[]>(`/research/${id}/events`));
      if (r.sourceCount > 0) setSources(await api<Source[]>(`/research/${id}/sources`));
      if (r.status === "completed" && !loadedResult.current) {
        loadedResult.current = true;
        const [rep, cl] = await Promise.all([
          api<Report>(`/research/${id}/report`),
          api<Claim[]>(`/research/${id}/claims`),
        ]);
        setReport(rep);
        setClaims(cl);
      }
      return r;
    } catch (e) {
      if (id?.startsWith("demo-")) {
        setRun(DEMO_ESP32_RUN);
        setEvents(DEMO_ESP32_EVENTS);
        setSources(DEMO_ESP32_SOURCES);
        setReport(DEMO_ESP32_REPORT);
        setClaims(DEMO_ESP32_CLAIMS);
        return DEMO_ESP32_RUN;
      }
      setError(e instanceof Error ? e.message : "Could not load this run");
      return null;
    }
  }, [id]);

  useEffect(() => {
    loadedResult.current = false;
    let stop = false;
    let timer: number;
    const tick = async () => {
      const r = await refresh();
      if (!stop && r && !TERMINAL.includes(r.status)) timer = window.setTimeout(tick, 2000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  function jumpToSource(label: string) {
    setOpenSource(label);
    setActiveTab("report");
    requestAnimationFrame(() =>
      document.getElementById(`src-${label}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  }

  function handleSelectClaimFromGraph(claimId: string) {
    setActiveTab("report");
    requestAnimationFrame(() => {
      const el = document.getElementById(claimId);
      if (el) {
        (el as HTMLDetailsElement).open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  async function action(path: string, method = "POST") {
    try {
      await api(`/research/${id}${path}`, { method });
      if (method === "DELETE") return nav("/dashboard");
      loadedResult.current = false;
      setReport(null);
      setClaims([]);
      const r = await refresh();
      if (r && !TERMINAL.includes(r.status)) window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function saveClaimReview(claimId: string, status: "approved" | "corrected" | "flagged" | "unreviewed") {
    if (status === "corrected" && reviewCorrectedText.trim().length < 4) {
      setError("Please enter corrected wording before saving a correction.");
      return;
    }
    setError("");
    if (id?.startsWith("demo-")) {
      setClaims((prev) =>
        prev.map((c) =>
          c.claimId === claimId
            ? {
                ...c,
                humanReview: {
                  status,
                  note: reviewNote.trim() || undefined,
                  correctedText: status === "corrected" ? reviewCorrectedText.trim() : undefined,
                  reviewedAt: new Date().toISOString(),
                },
              }
            : c
        )
      );
      setReviewingClaimId(null);
      setReviewNote("");
      setReviewCorrectedText("");
      return;
    }

    try {
      const updated = await api<Claim>(`/research/${id}/claims/${claimId}/review`, {
        method: "PATCH",
        json: {
          status,
          note: reviewNote.trim() || undefined,
          correctedText: status === "corrected" ? reviewCorrectedText.trim() : undefined,
        },
      });
      setClaims((prev) => prev.map((c) => (c.claimId === claimId ? updated : c)));
      setReviewingClaimId(null);
      setReviewNote("");
      setReviewCorrectedText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save review");
    }
  }

  async function handleExport(type: "pdf" | "md") {
    if (id?.startsWith("demo-")) {
      if (!report) return;
      const md = `# ${report.title}\n\n${report.summary}\n\n` +
        report.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "evidence-desk-demo-report.md";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      await downloadApiFile(`/research/${id}/report.${type}`, `evidence-desk-report.${type}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  function copyShareSummary() {
    if (!report || !run) return;
    const summaryText = [
      `# ${report.title}`,
      `Question: ${run.question}`,
      "",
      report.summary,
      "",
      "Sources:",
      ...sources.map((s) => `[${s.label}] ${s.title} - ${s.url} (Published: ${s.publishedAt ?? "Unknown"})`),
    ].join("\n");
    navigator.clipboard.writeText(summaryText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  }

  if (error && !run) return <p className="error center">{error}</p>;
  if (!run) return <p className="center muted">Loading research workspace…</p>;

  const active = !TERMINAL.includes(run.status);
  const stageIdx = STAGES.indexOf(run.status);
  const allWarnings = [...new Set([...(report?.collectionWarnings ?? []), ...(run.warnings ?? [])])];

  return (
    <div className="page run-container">
      <div className="run-header">
        <div className="row" style={{ gap: "1rem" }}>
          <Link to="/dashboard" className="back-link">← History</Link>
          {run.workspaceId && (
            <Link to={`/workspaces/${run.workspaceId}`} className="back-link">← Back to Workspace</Link>
          )}
        </div>
        <h1 className="run-title">{run.question}</h1>
        <div className="run-actions">
          <span className={`badge ${run.status}`}>{run.status}</span>
          {run.status === "completed" && report && (
            <>
              <button className="btn small" onClick={() => handleExport("pdf")}>
                Download PDF
              </button>
              <button className="btn small ghost" onClick={() => handleExport("md")}>
                Export Markdown
              </button>
              <button className="btn small ghost" onClick={copyShareSummary}>
                {copiedShare ? "Copied!" : "Share Summary"}
              </button>
            </>
          )}
          {active && <button className="btn small ghost" onClick={() => action("/cancel")}>Cancel</button>}
          {(run.status === "failed" || run.status === "cancelled") && (
            <button className="btn small" onClick={() => action("/retry")}>Retry Run</button>
          )}
          {!active && !id?.startsWith("demo-") && (
            <button className="btn small danger" onClick={() => confirm("Delete this run?") && action("", "DELETE")}>
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {run.status === "failed" && (
        <div className="notice err">
          <strong>This run encountered an issue:</strong> {run.error}
        </div>
      )}
      {allWarnings.length > 0 && (
        <div className="notice err" style={{ marginBottom: "1rem" }}>
          <strong>Collection & Freshness Notices ({allWarnings.length}):</strong>
          <ul style={{ marginTop: "0.4rem", paddingLeft: "1.2rem" }}>
            {allWarnings.map((w, idx) => (
              <li key={idx} className="small">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {(active || run.status === "failed") && (
        <section className="progress card">
          <h3 style={{ fontSize: "1rem", color: "var(--ink-2)", marginBottom: "0.5rem" }}>Pipeline Progress</h3>
          <ol className="stages">
            {STAGES.slice(0, 6).map((s, i) => (
              <li key={s} className={i < stageIdx ? "done" : i === stageIdx ? "now" : ""}>{s}</li>
            ))}
          </ol>
          {run.searchQueries.length > 0 && (
            <div className="search-queries-box">
              <span className="small muted">Search vectors:</span>
              <div className="query-tags">
                {run.searchQueries.map((q, idx) => (
                  <span key={idx} className="query-tag">“{q}”</span>
                ))}
              </div>
            </div>
          )}
          <ul className="events">
            {events.map((e) => (
              <li key={e._id} className={e.level}>
                <time>{new Date(e.timestamp).toLocaleTimeString()}</time> {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* RESEARCH VIEW TABS */}
      {report && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            borderBottom: "1px solid var(--line)",
            paddingBottom: "0.6rem",
            overflowX: "auto",
            marginTop: "1rem",
          }}
        >
          <button
            className={`btn small ${activeTab === "report" ? "" : "ghost"}`}
            onClick={() => setActiveTab("report")}
          >
            Synthesis Report
          </button>
          <button
            className={`btn small ${activeTab === "graph" ? "" : "ghost"}`}
            onClick={() => setActiveTab("graph")}
          >
            🕸️ Knowledge Graph
          </button>
          <button
            className={`btn small ${activeTab === "contradictions" ? "" : "ghost"}`}
            onClick={() => setActiveTab("contradictions")}
          >
            ⚖️ Contradiction Radar
          </button>
          <button
            className={`btn small ${activeTab === "chat" ? "" : "ghost"}`}
            onClick={() => setActiveTab("chat")}
          >
            🗣️ Cross-Examine
          </button>
          <button
            className={`btn small ${activeTab === "citations" ? "" : "ghost"}`}
            onClick={() => setActiveTab("citations")}
          >
            📚 Citations (BibTeX/APA)
          </button>
        </div>
      )}

      {/* TAB 1: REPORT & EVIDENCE */}
      {activeTab === "report" && report && (
        <>
          <article className="report">
            <header className="report-header">
              <span className="chip chip-up" style={{ marginBottom: "0.8rem" }}>Evidence-Backed Briefing</span>
              <h1>{report.title}</h1>
              <p className="summary report-prose">
                <CitedText text={report.summary} onCite={jumpToSource} />
              </p>
            </header>

            {report.changesSummary && report.changesSummary.length > 0 && (
              <section className="card" style={{ marginBottom: "1.5rem", padding: "1.1rem", borderColor: "rgba(255, 194, 122, 0.3)" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "var(--warn)" }}>
                  What Changed Since Earlier Snapshots
                </h3>
                <ul style={{ paddingLeft: "1.2rem" }}>
                  {report.changesSummary.map((ch, idx) => (
                    <li key={idx} className="small" style={{ color: "var(--ink-2)", marginBottom: "0.25rem" }}>{ch}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="report-sections">
              {report.sections.map((s, i) => (
                <section key={i} className="report-section-block">
                  <h2>{s.heading}</h2>
                  <p className="report-prose">
                    <CitedText text={s.body} onCite={jumpToSource} />
                  </p>
                  {s.claimIds.length > 0 && (
                    <div className="claims-meta-row">
                      <span className="small muted">Claims referenced:</span>
                      {s.claimIds.map((c) => (
                        <a key={c} href={`#${c}`} className="claim-pill-link">
                          {c}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {report.disagreements && report.disagreements.length > 0 && (
              <section className="notice" style={{ marginTop: "1.5rem", borderColor: "var(--warn-border)" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "0.4rem", color: "var(--warn)" }}>Disagreements Between Sources</h3>
                <ul style={{ paddingLeft: "1.2rem" }}>
                  {report.disagreements.map((d, i) => (
                    <li key={i} style={{ fontSize: "0.9rem", color: "var(--ink-2)" }}>{d}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="notice" style={{ marginTop: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", marginBottom: "0.4rem" }}>Limitations & Provenance</h3>
              <ul>
                {report.limitations.map((l, i) => (
                  <li key={i} style={{ fontSize: "0.9rem", color: "var(--ink-2)" }}>{l}</li>
                ))}
              </ul>
            </section>
          </article>

          {claims.length > 0 && (
            <section className="claims-section">
              <div className="section-title-row">
                <h2>Inspectable Claims ({claims.length})</h2>
                <span className="small muted">Click any claim to inspect its quote check, meaning check, and add human corrections</span>
              </div>

              <div className="claims-grid">
                {claims.map((c) => {
                  const displayText =
                    c.humanReview?.status === "corrected" && c.humanReview.correctedText
                      ? c.humanReview.correctedText
                      : c.text;
                  const isEditingReview = reviewingClaimId === c.claimId;
                  const hasCodeMatch = c.codeVerified ?? c.evidence.length > 0;

                  return (
                    <details key={c._id} id={c.claimId} className={`claim ${c.status}`}>
                      <summary>
                        <span className={`badge ${c.status}`}>{plainClaimStatus(c.status)}</span>
                        <span className="claim-text">{displayText}</span>
                        {c.humanReview?.status && c.humanReview.status !== "unreviewed" && (
                          <span className="badge completed" style={{ fontSize: "0.72rem" }}>
                            Human: {c.humanReview.status}
                          </span>
                        )}
                        <span className="claim-id-tag">{c.claimId}</span>
                      </summary>
                      <div className="claim-body">
                        <div className="row between wrap" style={{ marginBottom: "0.6rem", gap: "0.5rem" }}>
                          <span className={`small badge ${hasCodeMatch ? "supported" : "insufficient"}`}>
                            {hasCodeMatch ? "✓ Code Quote Check: Matched in saved snapshot" : "⚠ Code Quote Check: No verbatim match"}
                          </span>
                          {c.humanReview?.status === "corrected" && (
                            <span className="small muted">Original AI claim: “{c.text}”</span>
                          )}
                        </div>

                        {c.reasoning && (
                          <p className="small muted" style={{ marginBottom: "0.6rem" }}>
                            <strong>AI Meaning Check:</strong> {c.reasoning}
                          </p>
                        )}
                        {c.evidence.length === 0 ? (
                          <p className="small muted">No verbatim excerpt matched in saved source text.</p>
                        ) : (
                          c.evidence.map((ev, i) => {
                            const srcObj = sources.find((s) => s.label === ev.sourceLabel);
                            return (
                              <blockquote key={i}>
                                <div className="row between wrap" style={{ marginBottom: "0.3rem", gap: "0.4rem" }}>
                                  <div className="row" style={{ gap: "0.4rem" }}>
                                    <button className="cite" onClick={() => jumpToSource(ev.sourceLabel)}>
                                      {ev.sourceLabel}
                                    </button>
                                    {srcObj && (
                                      <span className="small muted">
                                        {srcObj.title} ({srcObj.isOfficial ? "Official" : srcObj.sourceType?.replace("_", " ") ?? "External"})
                                        {" · "}
                                        {srcObj.publishedAt ? `Published ${srcObj.publishedAt}` : "Published: Unknown"}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`small support-tag ${ev.supportType}`}>{ev.supportType}</span>
                                </div>
                                “{ev.excerpt}”
                              </blockquote>
                            );
                          })
                        )}
                        {c.limitations.length > 0 && (
                          <p className="small muted" style={{ marginTop: "0.5rem" }}>
                            Limitations: {c.limitations.join("; ")}
                          </p>
                        )}
                        {c.humanReview?.note && (
                          <p className="small" style={{ marginTop: "0.4rem", color: "var(--ok)" }}>
                            <strong>Reviewer Note:</strong> {c.humanReview.note}
                          </p>
                        )}

                        {/* HUMAN REVIEW CONTROLS */}
                        <div style={{ marginTop: "0.8rem", paddingTop: "0.6rem", borderTop: "1px solid var(--line)" }}>
                          {!isEditingReview ? (
                            <div className="row wrap" style={{ gap: "0.5rem" }}>
                              <button
                                type="button"
                                className="btn small ghost"
                                onClick={() => saveClaimReview(c.claimId, "approved")}
                              >
                                ✓ Approve
                              </button>
                              <button
                                type="button"
                                className="btn small ghost"
                                onClick={() => {
                                  setReviewingClaimId(c.claimId);
                                  setReviewCorrectedText(c.humanReview?.correctedText || c.text);
                                  setReviewNote(c.humanReview?.note || "");
                                }}
                              >
                                ✎ Correct / Add Note
                              </button>
                              <button
                                type="button"
                                className="btn small ghost"
                                onClick={() => saveClaimReview(c.claimId, "flagged")}
                              >
                                ⚑ Flag Issue
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              <label className="small">
                                Corrected finding wording
                                <textarea
                                  rows={2}
                                  value={reviewCorrectedText}
                                  onChange={(e) => setReviewCorrectedText(e.target.value)}
                                />
                              </label>
                              <label className="small">
                                Reviewer note (optional)
                                <input
                                  value={reviewNote}
                                  onChange={(e) => setReviewNote(e.target.value)}
                                  placeholder="Why was this updated or noted?"
                                />
                              </label>
                              <div className="row" style={{ gap: "0.5rem" }}>
                                <button type="button" className="btn small" onClick={() => saveClaimReview(c.claimId, "corrected")}>
                                  Save Correction
                                </button>
                                <button type="button" className="btn small ghost" onClick={() => setReviewingClaimId(null)}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}

          {sources.length > 0 && (
            <section className="sources-section">
              <h2>Saved Sources & Snapshots ({sources.length})</h2>
              <p className="small muted" style={{ marginBottom: "1rem" }}>
                Every source below was collected from public URLs or approved feeds. Dates not provided by the source are marked as Unknown.
              </p>
              <div className="sources-list">
                {sources.map((s) => (
                  <div key={s._id} id={`src-${s.label}`} className={`source ${openSource === s.label ? "open" : ""}`}>
                    <div className="source-header">
                      <span className="cite static">{s.label}</span>
                      <span className={`badge ${s.isOfficial ? "supported" : "mixed"}`}>
                        {s.isOfficial ? "Official" : (s.sourceType ?? "External").replace("_", " ")}
                      </span>
                      {s.changeStatus && s.changeStatus !== "unchanged" && (
                        <span className={`badge ${s.changeStatus === "changed" ? "mixed" : "completed"}`}>
                          {s.changeStatus.replace("_", " ")}
                        </span>
                      )}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">
                        {s.title}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}>
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    </div>
                    <p className="small muted source-meta">
                      <span>{s.publisher || s.domain}</span>
                      <span>· {s.publishedAt ? `Published: ${s.publishedAt}` : "Published: Unknown"}</span>
                      <span>· Retrieved: {new Date(s.retrievedAt).toLocaleString()}</span>
                      <span>· {s.contentType.replace("_", " ")}</span>
                    </p>
                    {s.diffSummary && (
                      <p className="small" style={{ color: "var(--peri-2)", marginBottom: "0.3rem" }}>
                        {s.diffSummary}
                      </p>
                    )}
                    <p className="excerpt">“{s.excerpt}”</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* TAB 2: KNOWLEDGE GRAPH */}
      {activeTab === "graph" && (
        <EvidenceGraph
          question={run.question}
          claims={claims}
          sources={sources}
          onSelectClaim={handleSelectClaimFromGraph}
        />
      )}

      {/* TAB 3: CONTRADICTION MATRIX */}
      {activeTab === "contradictions" && <ContradictionMatrix claims={claims} />}

      {/* TAB 4: CROSS-EXAMINE CHAT */}
      {activeTab === "chat" && <CrossExamineChat runId={run._id} />}

      {/* TAB 5: SCHOLARLY CITATIONS */}
      {activeTab === "citations" && <CitationExporter sources={sources} topic={run.question} />}
    </div>
  );
}
