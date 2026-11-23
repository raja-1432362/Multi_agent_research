import { Fragment } from "react";

/** Renders text with [S1] markers as clickable chips that jump to the stored source. */
export default function CitedText({ text, onCite }: { text: string; onCite: (label: string) => void }) {
  const parts = text.split(/(\[S\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[(S\d+)\]$/);
        if (!m) return <Fragment key={i}>{p}</Fragment>;
        return (
          <button key={i} className="cite" onClick={() => onCite(m[1])} title={`Open source ${m[1]}`}>
            {m[1]}
          </button>
        );
      })}
    </>
  );
}
