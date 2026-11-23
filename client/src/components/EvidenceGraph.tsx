import { useMemo } from "react";
import { ReactFlow, Background, Controls, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Claim, Source } from "../types";

export default function EvidenceGraph({
  question,
  claims,
  sources,
  onSelectClaim,
}: {
  question: string;
  claims: Claim[];
  sources: Source[];
  onSelectClaim: (claimId: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];

    // Central Question Node
    n.push({
      id: "root",
      type: "input",
      position: { x: 350, y: 30 },
      data: {
        label: (
          <div style={{ textAlign: "center", padding: "8px" }}>
            <span style={{ fontSize: "10px", color: "#9f96ce", textTransform: "uppercase" }}>Research Topic</span>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#fff", marginTop: "2px" }}>
              {question.slice(0, 50)}...
            </div>
          </div>
        ),
      },
      style: {
        background: "linear-gradient(135deg, #4b3bd6, #160c40)",
        color: "#fff",
        border: "1px solid #8d94ff",
        borderRadius: "10px",
        width: 260,
        boxShadow: "0 0 16px rgba(111, 120, 255, 0.4)",
      },
    });

    // Claim Nodes in a circular/tiered layout
    const radius = 240;
    const count = Math.min(claims.length, 12);
    const angleStep = (2 * Math.PI) / (count || 1);

    claims.slice(0, 12).forEach((c, idx) => {
      const angle = idx * angleStep;
      const x = 350 + Math.cos(angle) * radius;
      const y = 300 + Math.sin(angle) * (radius * 0.85);

      const statusColor =
        c.status === "supported" ? "#7cf0bd" : c.status === "contradicted" ? "#ff8fa3" : "#ffc27a";

      n.push({
        id: `claim-${c.claimId}`,
        position: { x, y },
        data: {
          label: (
            <div
              onClick={() => onSelectClaim(c.claimId)}
              style={{ cursor: "pointer", padding: "6px", textAlign: "left" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", color: statusColor, fontWeight: 600, textTransform: "uppercase" }}>
                  {c.status}
                </span>
                <span style={{ fontSize: "10px", fontFamily: "var(--mono)", color: "#9f96ce" }}>{c.claimId}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#f8f7ff", lineHeight: 1.35 }}>
                {c.text.length > 55 ? `${c.text.slice(0, 55)}...` : c.text}
              </div>
            </div>
          ),
        },
        style: {
          background: "rgba(28, 19, 74, 0.9)",
          border: `1px solid ${statusColor}`,
          borderRadius: "8px",
          width: 200,
          boxShadow: `0 4px 12px rgba(6, 2, 30, 0.5)`,
        },
      });

      e.push({
        id: `e-root-${c.claimId}`,
        source: "root",
        target: `claim-${c.claimId}`,
        animated: true,
        style: { stroke: "rgba(141, 148, 255, 0.35)", strokeWidth: 1.5 },
      });
    });

    return { nodes: n, edges: e };
  }, [question, claims, onSelectClaim]);

  return (
    <div className="card" style={{ height: "480px", padding: "0.5rem", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "14px",
          zIndex: 10,
          display: "flex",
          gap: "8px",
          alignItems: "center",
          background: "rgba(14, 10, 48, 0.8)",
          padding: "4px 10px",
          borderRadius: "6px",
          border: "1px solid var(--line)",
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600 }}>Interactive Evidence Topology</span>
        <span className="small muted">· Drag to pan, scroll to zoom</span>
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="rgba(196, 178, 255, 0.1)" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
