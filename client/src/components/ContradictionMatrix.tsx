import { useState } from "react";
import type { Claim } from "../types";

export default function ContradictionMatrix({ claims }: { claims: Claim[] }) {
  const disputed = claims.filter((c) => c.status === "mixed" || c.status === "contradicted");

  if (disputed.length === 0) {
    return (
      <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
        <h3 style={{ fontSize: "1.1rem", color: "var(--ok)", marginBottom: "0.4rem" }}>
          ✓ No Major Academic Contradictions Flagged
        </h3>
        <p className="small muted">
          All extracted claims showed consistent direction across retrieved sources with no contradictory evidence.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "1.5rem" }}>
      <div className="row between wrap" style={{ marginBottom: "1rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Disputed Claims & Contradiction Radar</h3>
          <p className="small muted">
            Identifies where academic literature or industry reports contest findings.
          </p>
        </div>
        <span className="badge mixed">{disputed.length} Contested Finding(s)</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {disputed.map((c) => (
          <div
            key={c._id}
            style={{
              background: "rgba(18, 12, 50, 0.6)",
              border: "1px solid rgba(255, 194, 122, 0.3)",
              borderLeft: "4px solid var(--warn)",
              borderRadius: "8px",
              padding: "1rem",
            }}
          >
            <div className="row between" style={{ marginBottom: "0.5rem" }}>
              <span className={`badge ${c.status}`}>{c.status}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: "0.78rem", color: "var(--ink-3)" }}>
                {c.claimId}
              </span>
            </div>

            <p style={{ fontWeight: 500, fontSize: "1rem", color: "#fff", marginBottom: "0.6rem" }}>
              {c.text}
            </p>

            {c.reasoning && (
              <p className="small muted" style={{ marginBottom: "0.6rem" }}>
                <strong>Contradiction Analysis:</strong> {c.reasoning}
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", marginTop: "0.6rem" }}>
              {c.evidence.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid var(--line)",
                    fontSize: "0.85rem",
                  }}
                >
                  <div className="row between" style={{ marginBottom: "0.25rem" }}>
                    <span className="cite static">{ev.sourceLabel}</span>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontFamily: "var(--mono)",
                        color: ev.supportType === "supports" ? "var(--ok)" : "var(--bad)",
                        textTransform: "uppercase",
                      }}
                    >
                      {ev.supportType}
                    </span>
                  </div>
                  <div style={{ color: "var(--ink-2)", lineHeight: 1.45 }}>“{ev.excerpt}”</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
