import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Run } from "../types";

export default function Dashboard() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Run[]>("/research").then(setRuns).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error center">{error}</p>;
  if (!runs) return <p className="center muted">Loading…</p>;

  return (
    <div className="page">
      <div className="row between">
        <h2>Research history</h2>
        <Link to="/new" className="btn small">New research</Link>
      </div>
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
