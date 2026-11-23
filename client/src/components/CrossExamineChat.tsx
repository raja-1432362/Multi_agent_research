import { useState, FormEvent } from "react";
import { api } from "../services/api";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  unsupported?: boolean;
}

export default function CrossExamineChat({ runId }: { runId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setBusy(true);

    try {
      const res = await api<{ answer: string; citedSourceLabels: string[]; unsupportedOrMissing: boolean }>(
        `/research/${runId}/chat`,
        { method: "POST", json: { question: q } }
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.answer,
          sources: res.citedSourceLabels,
          unsupported: res.unsupportedOrMissing,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Failed to query the evidence base.",
          unsupported: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Cross-Examine Grounded Evidence</h3>
        <p className="small muted">
          Ask specific follow-up questions. Answers are programmatically restricted to the stored source excerpts.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          minHeight: "180px",
          maxHeight: "340px",
          overflowY: "auto",
          paddingRight: "6px",
          marginBottom: "1rem",
        }}
      >
        {messages.length === 0 ? (
          <div className="empty" style={{ padding: "2rem" }}>
            <span className="small muted">
              Try asking: "Which specific authors or papers dispute this?" or "Did any source discuss cost or latency?"
            </span>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "0.75rem 1rem",
                borderRadius: "10px",
                background:
                  m.role === "user"
                    ? "var(--peri)"
                    : m.unsupported
                    ? "rgba(255, 143, 163, 0.12)"
                    : "rgba(22, 14, 60, 0.9)",
                border: m.role === "user" ? "none" : "1px solid var(--line)",
                color: "#fff",
                fontSize: "0.92rem",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.75rem", marginBottom: "3px", color: m.role === "user" ? "#e0e3ff" : "#9f96ce" }}>
                {m.role === "user" ? "YOU" : "EVIDENCE AUDITOR"}
              </div>
              <div>{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: "0.5rem", display: "flex", gap: "4px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "#9f96ce" }}>Citing:</span>
                  {m.sources.map((s) => (
                    <span key={s} className="cite static">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} style={{ display: "flex", gap: "0.6rem" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question against stored sources..."
          style={{ flex: 1 }}
          disabled={busy}
        />
        <button className="btn small" disabled={busy || !input.trim()}>
          {busy ? "Auditing..." : "Audit"}
        </button>
      </form>
    </div>
  );
}
