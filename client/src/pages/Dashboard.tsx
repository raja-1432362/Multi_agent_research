import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../services/api";
import type { Run } from "../types";

const DEMO_RUNS: Run[] = [
  {
    _id: "demo-esp32",
    question: "ESP32 microcontroller technical architecture, memory, and wireless capabilities",
    status: "completed",
    currentStage: "completed",
    scope: { depth: "balanced", maxSources: 10 },
    searchQueries: ["ESP32 datasheet architecture", "ESP32 power consumption deep sleep", "ESP32 vs STM32 real time"],
    sourceCount: 10,
    warnings: [],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    _id: "demo-quantum",
    question: "What are the latest advancements in quantum computing in 2026?",
    status: "completed",
    currentStage: "completed",
    scope: { depth: "deep", maxSources: 12 },
    searchQueries: ["Quantum computing advancements 2026", "Neutral atom qubits", "Fault tolerant quantum error correction"],
    sourceCount: 12,
    warnings: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [isDemoRuns, setIsDemoRuns] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.id === "demo-user") {
      setRuns(DEMO_RUNS);
      setIsDemoRuns(true);
      return;
    }
    api<Run[]>("/research")
      .then((list) => {
        setRuns(list);
        setIsDemoRuns(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not load research history");
        setRuns([]);
      });
  }, [user?.id]);

  if (!runs) return <p className="center muted">Loading…</p>;

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: "1rem" }}>
        <h2>Research history</h2>
        <div className="row" style={{ gap: "0.6rem" }}>
          <Link to="/workspaces" className="btn small ghost">Competitor Watchlists</Link>
          <Link to="/new" className="btn small">New research</Link>
        </div>
      </div>
      {error && <p className="error" role="alert" style={{ marginBottom: "1rem" }}>{error}</p>}
      {isDemoRuns && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          <strong>Demo Data:</strong> Showing sample research reports. Sign in with a real account to run live checks.
        </div>
      )}
      {runs.length === 0 ? (
        <div className="empty">
          <p>No research runs yet.</p>
          <Link to="/new" className="btn">Ask your first question</Link>
        </div>
      ) : (
        <ul className="runlist">
          {runs.map((r) => (
            <li key={r._id}>
              <Link to={`/research/${r._id}`}>
                <span className="q">{r.question}</span>
                <span className="meta">
                  <span className={`badge ${r.status}`}>{r.status}</span>
                  {r.sourceCount > 0 && <span>{r.sourceCount} sources</span>}
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
