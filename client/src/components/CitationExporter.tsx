import { useState } from "react";
import type { Source } from "../types";

export function formatBibTeX(sources: Source[], topic: string): string {
  return sources
    .map((s, i) => {
      const citeKey = `${s.domain.replace(/[^a-zA-Z0-9]/g, "") || "source"}_${s.label}`;
      const year = s.publishedAt ? s.publishedAt.slice(0, 4) : new Date(s.retrievedAt).getFullYear();
      return `@misc{${citeKey},
  title = {${s.title.replace(/[{}]/g, "")}},
  author = {{${s.domain}}},
  year = {${year}},
  howpublished = {\\url{${s.url}}},
  note = {Retrieved for: ${topic}}
}`;
    })
    .join("\n\n");
}

export function formatAPA(sources: Source[]): string {
  return sources
    .map((s) => {
      const year = s.publishedAt ? `(${s.publishedAt.slice(0, 4)})` : "(n.d.)";
      return `${s.domain}. ${year}. ${s.title}. Available at: ${s.url}`;
    })
    .join("\n\n");
}

export function formatIEEE(sources: Source[]): string {
  return sources
    .map((s, idx) => {
      const year = s.publishedAt ? s.publishedAt.slice(0, 4) : new Date(s.retrievedAt).getFullYear();
      return `[${idx + 1}] ${s.domain}, "${s.title}," ${year}. [Online]. Available: ${s.url}. [Accessed: ${new Date(
        s.retrievedAt
      ).toLocaleDateString()}].`;
    })
    .join("\n\n");
}

export default function CitationExporter({ sources, topic }: { sources: Source[]; topic: string }) {
  const [format, setFormat] = useState<"bibtex" | "apa" | "ieee">("bibtex");
  const [copied, setCopied] = useState(false);

  let formattedText = "";
  if (format === "bibtex") formattedText = formatBibTeX(sources, topic);
  else if (format === "apa") formattedText = formatAPA(sources);
  else formattedText = formatIEEE(sources);

  function copyText() {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadBib() {
    const blob = new Blob([formattedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citations-${format}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div className="row between wrap">
        <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Scholarly Citation Exporter</h3>
        <div className="row" style={{ gap: "0.5rem" }}>
          <button
            className={`btn small ${format === "bibtex" ? "" : "ghost"}`}
            onClick={() => setFormat("bibtex")}
          >
            BibTeX (.bib)
          </button>
          <button
            className={`btn small ${format === "apa" ? "" : "ghost"}`}
            onClick={() => setFormat("apa")}
          >
            APA 7th
          </button>
          <button
            className={`btn small ${format === "ieee" ? "" : "ghost"}`}
            onClick={() => setFormat("ieee")}
          >
            IEEE
          </button>
        </div>
      </div>

      <pre
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.82rem",
          padding: "1rem",
          borderRadius: "8px",
          background: "rgba(12, 8, 38, 0.9)",
          border: "1px solid var(--line)",
          color: "#d6d0f5",
          overflowX: "auto",
          maxHeight: "320px",
          lineHeight: "1.5",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {formattedText}
      </pre>

      <div className="row" style={{ gap: "0.8rem", justifyContent: "flex-end" }}>
        <button className="btn small ghost" onClick={copyText}>
          {copied ? "✓ Copied to clipboard" : "Copy citations"}
        </button>
        <button className="btn small" onClick={downloadBib}>
          Download file
        </button>
      </div>
    </div>
  );
}
