import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import CitedText from "../components/CitedText";
import EvidenceGraph from "../components/EvidenceGraph";
import CitationExporter from "../components/CitationExporter";
import ContradictionMatrix from "../components/ContradictionMatrix";
import CrossExamineChat from "../components/CrossExamineChat";
import { Claim, Report, Run, RunEvent, Source, STAGES, TERMINAL } from "../types";
import {
  DEMO_ESP32_RUN,
  DEMO_ESP32_REPORT,
  DEMO_ESP32_CLAIMS,
  DEMO_ESP32_SOURCES,
  DEMO_ESP32_EVENTS,
} from "../services/demoData";

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

  if (error && !run) return <p className="error center">{error}</p>;
  if (!run) return <p className="center muted">Loading research workspace…</p>;

  const active = !TERMINAL.includes(run.status);
  const stageIdx = STAGES.indexOf(run.status);

  return (
    <div className="page run-container">
      <div className="run-header">
        <Link to="/dashboard" className="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to History
        </Link>
        <h1 className="run-title">{run.question}</h1>
        <div className="run-actions">
          <span className={`badge ${run.status}`}>{run.status}</span>
          {run.status === "completed" && (
            <a className="btn small" href={`/api/research/${run._id}/report.pdf`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download PDF
            </a>
          )}
          {active && <button className="btn small ghost" onClick={() => action("/cancel")}>Cancel</button>}
          {(run.status === "failed" || run.status === "cancelled") && (
            <button className="btn small" onClick={() => action("/retry")}>Retry Run</button>
          )}
          {!active && (
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
              <span className="chip chip-up" style={{ marginBottom: "0.8rem" }}>Verified Synthesis Report</span>
              <h1>{report.title}</h1>
              <p className="summary report-prose">
                <CitedText text={report.summary} onCite={jumpToSource} />
              </p>
            </header>

            <div className="report-sections">
              {report.sections.map((s, i) => (
                <section key={i} className="report-section-block">
                  <h2>{s.heading}</h2>
                  <p className="report-prose">
                    <CitedText text={s.body} onCite={jumpToSource} />
                  </p>
                  {s.claimIds.length > 0 && (
                    <div className="claims-meta-row">
                      <span className="small muted">Claims verified:</span>
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

            <section className="notice" style={{ marginTop: "2rem" }}>
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
                <h2>Extracted Atomic Claims ({claims.length})</h2>
                <span className="small muted">Click any claim to inspect verbatim source proof</span>
              </div>

              <div className="claims-grid">
                {claims.map((c) => (
                  <details key={c._id} id={c.claimId} className={`claim ${c.status}`}>
                    <summary>
                      <span className={`badge ${c.status}`}>{c.status}</span>
                      <span className="claim-text">{c.text}</span>
                      <span className="claim-id-tag">{c.claimId}</span>
                    </summary>
                    <div className="claim-body">
                      {c.reasoning && (
                        <p className="small muted" style={{ marginBottom: "0.6rem" }}>
                          <strong>Reasoning:</strong> {c.reasoning}
                        </p>
                      )}
                      {c.evidence.length === 0 ? (
                        <p className="small muted">No verbatim excerpt verified for this claim.</p>
                      ) : (
                        c.evidence.map((ev, i) => (
                          <blockquote key={i}>
                            <div className="row between" style={{ marginBottom: "0.3rem" }}>
                              <button className="cite" onClick={() => jumpToSource(ev.sourceLabel)}>
                                {ev.sourceLabel}
                              </button>
                              <span className={`small support-tag ${ev.supportType}`}>{ev.supportType}</span>
                            </div>
                            “{ev.excerpt}”
                          </blockquote>
                        ))
                      )}
                      {c.limitations.length > 0 && (
                        <p className="small muted" style={{ marginTop: "0.5rem" }}>
                          Limitations: {c.limitations.join("; ")}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {sources.length > 0 && (
            <section className="sources-section">
              <h2>Stored Evidence Excerpts ({sources.length})</h2>
              <p className="small muted" style={{ marginBottom: "1rem" }}>
                Every record below was retrieved from live web or academic sources and stored in MongoDB Atlas.
              </p>
              <div className="sources-list">
                {sources.map((s) => (
                  <div key={s._id} id={`src-${s.label}`} className={`source ${openSource === s.label ? "open" : ""}`}>
                    <div className="source-header">
                      <span className="cite static">{s.label}</span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">
                        {s.title}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 6 }}>
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </a>
                    </div>
                    <p className="small muted source-meta">
                      <span>{s.domain}</span>
                      {s.publishedAt && <span>· Published {s.publishedAt}</span>}
                      <span>· Retrieved {new Date(s.retrievedAt).toLocaleDateString()}</span>
                      <span>· {s.contentType.replace("_", " ")}</span>
                    </p>
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
