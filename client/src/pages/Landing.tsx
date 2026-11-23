import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing page">
      <div style={{ textAlign: "center", margin: "2rem auto 3rem", maxWidth: "780px" }}>
        <span className="badge completed" style={{ marginBottom: "1rem" }}>Evidence-Grounded Intelligence</span>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "1rem" }}>
          Every claim in the report opens to the page it came from.
        </h1>
        <p className="muted" style={{ fontSize: "1.15rem", lineHeight: 1.6, maxWidth: "640px", margin: "0 auto 2rem" }}>
          Ask a research question. Evidence Desk searches the live web, stores each source in MongoDB, pulls out atomic claims, verifies them against verbatim excerpts, and writes a cited report.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/register" className="btn">Ask your first question</Link>
          <a href="/landing.html" className="btn ghost">View 3D Interactive Story</a>
        </div>
      </div>

      <div className="sample card" style={{ padding: "2rem" }}>
        <p className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Example Output</p>
        <h2 style={{ fontSize: "1.4rem", margin: "0.4rem 0 1rem" }}>
          What is the current status of commercial solid-state batteries in 2026?
        </h2>
        <p className="report-prose" style={{ marginBottom: "1.5rem" }}>
          Pilot production has begun for select high-end vehicles <span className="cite static">S1</span>, but mass-market adoption remains constrained by manufacturing yields and electrolyte degradation under fast-charging cycles <span className="cite static">S3</span>. Automakers currently project volume scale-up between late 2026 and 2028 <span className="cite static">S2</span>.
        </p>

        <h3 style={{ fontSize: "1.1rem", marginBottom: "0.8rem" }}>Inspectable Claims</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div className="claim supported" style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <span className="badge supported">supported</span>
            <span style={{ fontSize: "0.95rem", color: "#fff" }}>Toyota and Idemitsu began joint pilot-line operations for sulfide electrolytes.</span>
            <span className="cite static" style={{ marginLeft: "auto" }}>S1</span>
          </div>
          <div className="claim mixed" style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <span className="badge mixed">mixed</span>
            <span style={{ fontSize: "0.95rem", color: "#fff" }}>Target cell costs projected below $60/kWh by 2026.</span>
            <span className="cite static" style={{ marginLeft: "auto" }}>S3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
