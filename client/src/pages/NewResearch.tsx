import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Run } from "../types";

export default function NewResearch() {
  const nav = useNavigate();
  const [question, setQuestion] = useState("");
  const [depth, setDepth] = useState("standard");
  const [maxSources, setMaxSources] = useState(10);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const run = await api<Run>("/research", { method: "POST", json: { question, depth, maxSources, dateFrom, dateTo } });
      nav(`/research/${run._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New research</h2>
      <label>
        Research question
        <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} required minLength={10} maxLength={500}
          placeholder="e.g. What does current evidence say about four-day work weeks and productivity?" />
      </label>
      <div className="grid3">
        <label>Depth
          <select value={depth} onChange={(e) => setDepth(e.target.value)}>
            <option value="quick">Quick (3 queries)</option>
            <option value="standard">Standard (4 queries)</option>
            <option value="deep">Deep (6 queries, advanced search)</option>
          </select>
        </label>
        <label>Max sources
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
