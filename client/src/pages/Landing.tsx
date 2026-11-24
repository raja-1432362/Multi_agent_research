import { useEffect } from "react";

export default function Landing() {
  useEffect(() => {
    window.location.replace("/landing.html");
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p className="muted">Opening 3D Hero Scene…</p>
    </div>
  );
}
