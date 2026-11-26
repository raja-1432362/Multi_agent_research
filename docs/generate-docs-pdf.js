const fs = require("fs");
const path = require("path");
const pdfKitPath = path.join(__dirname, "..", "server", "node_modules", "pdfkit");
const PDFDocument = fs.existsSync(pdfKitPath) ? require(pdfKitPath) : require("pdfkit");

function buildPdf() {
  const outputPath = path.join(__dirname, "Evidence_Desk_Documentation.pdf");
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: {
      Title: "Evidence Desk — Updated Project Documentation",
      Author: "Evidence Desk Multi-Agent Research Studio",
    },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const PERI = "#4b3bd6";
  const ACCENT = "#6f78ff";
  const TEXT = "#1e1e2f";
  const MUTED = "#555566";

  // HEADER BANNER
  doc.rect(50, 45, 495, 80).fill("#140d3d");
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("Evidence Desk", 68, 60);
  doc.fontSize(10.5).font("Helvetica").fillColor("#c9b8ff")
    .text("Competitor Intelligence & Source-Backed Multi-Agent Research Assistant — Updated Guide", 68, 90, { width: 460 });

  doc.y = 142;
  doc.fillColor(TEXT);

  // SECTION 1: WHAT IS EVIDENCE DESK
  doc.fontSize(14).font("Helvetica-Bold").fillColor(PERI).text("1. What is Evidence Desk? (In Plain Words)");
  doc.moveDown(0.35);
  doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(
    "Standard AI chatbots often generate smooth answers without verifiable citations, mix old and new facts, or hide disagreements between sources.\n\n" +
    "Evidence Desk is built for B2B product teams, founders, and researchers to answer competitor, market, and research questions with inspectable proof. Instead of relying on unverified memory, it collects approved public sources (company pages, pricing, docs, release notes, RSS feeds, and uploaded public documents) plus permitted web/arXiv searches, saves snapshots in MongoDB, detects what changed since earlier runs, and links every claim to saved source text for human review.\n\n" +
    "Important: Evidence Desk supports human research and review — it does not make business decisions for you, and AI-assisted checks do not guarantee ground truth.",
    { lineGap: 2.5, align: "justify" }
  );

  doc.moveDown(0.9);

  // SECTION 2: KEY PROBLEMS SOLVED
  doc.fontSize(14).font("Helvetica-Bold").fillColor(PERI).text("2. Key Capabilities & Guardrails");
  doc.moveDown(0.35);

  const bullet = (title, desc) => {
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(ACCENT).text("• " + title + ": ", { continued: true });
    doc.font("Helvetica").fillColor(TEXT).text(desc, { lineGap: 2 });
    doc.moveDown(0.15);
  };

  bullet("Competitor Watchlists (Workspaces)", "Isolate companies, approved public URLs, RSS feeds, uploaded docs, and recurring checks (Manual, Daily, Weekly) per workspace.");
  bullet("Snapshot Diff & Change Detection", "SHA-256 content hashes and line diffs compare new snapshots with earlier ones (New, Changed, Unchanged, Failed, or Stale).");
  bullet("Two Separate Evidence Checks", "1) A deterministic Code Quote Check verifies the exact quote exists in saved text; 2) an AI Meaning Check evaluates whether it supports, contradicts, or lacks evidence.");
  bullet("Transparent Failures & Dates", "Blocked (401/403/429, CAPTCHA, paywall) or robots-disallowed checks stay visible instead of showing old data as fresh. Unknown dates are labeled Unknown.");
  bullet("Prompt-Injection & SSRF Defense", "Retrieved text is sanitized of control characters and kept strictly as untrusted DATA; private/localhost URLs are blocked and model outputs are Zod-validated.");

  doc.moveDown(0.8);

  // SECTION 3: HOW IT WORKS
  doc.fontSize(14).font("Helvetica-Bold").fillColor(PERI).text("3. Step-by-Step Multi-Agent Workflow (LangGraph.js)");
  doc.moveDown(0.35);

  const steps = [
    { num: "Step 1: Planner Agent (Gemini)", txt: "Turns the user's question and workspace watchlist into 3–6 focused search targets." },
    { num: "Step 2: Controlled Collector (Approved URLs / RSS / Uploads + Tavily)", txt: "Checks SSRF rules & robots.txt (RFC 9309), fetches approved sources, or runs domain-scoped/open search + arXiv." },
    { num: "Step 3: Normalizer & Change Checker", txt: "Deduplicates canonical URLs, saves SourceSnapshots, computes SHA-256 diffs, and logs failed/stale sources clearly." },
    { num: "Step 4: Analyst Agent (Gemini)", txt: "Extracts short testable claims tied strictly to saved source IDs, themes, and source disagreements." },
    { num: "Step 5: Dual Verifier (Code Quote Check + AI Meaning Check)", txt: "Confirms verbatim substring matches in code and classifies claims as Supported, Contradicted, or Not enough evidence." },
    { num: "Step 6: Report Writer & Save (Gemini + Metrics)", txt: "Produces a concise briefing with citations, change summaries, dates, disagreements, and run metrics." },
  ];

  steps.forEach((s) => {
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#222244").text(s.num);
    doc.font("Helvetica").fillColor(MUTED).text(s.txt, { indent: 12, lineGap: 1.8 });
    doc.moveDown(0.22);
  });

  // PAGE 2
  doc.addPage();

  doc.fontSize(14).font("Helvetica-Bold").fillColor(PERI).text("4. Built-In Product & Workspace Features");
  doc.moveDown(0.4);

  const features = [
    { title: "Competitor & Market Workspaces", desc: "Track companies, approved URLs, release notes, RSS feeds, and uploaded text/markdown documents with optional daily/weekly checks." },
    { title: "What Changed Timeline", desc: "Inspect exact added and removed lines between snapshots plus explicit failure/blocked warnings." },
    { title: "Human Review & Finding Corrections", desc: "Approve, flag, or edit any extracted claim directly in the report; corrections carry through to exported Markdown reports." },
    { title: "Interactive Knowledge Graph & Contradiction Radar", desc: "Visualizes topic-to-claim topology (@xyflow/react) and isolates conflicting claims side-by-side." },
    { title: "Grounded Cross-Examine Chat", desc: "Ask follow-up questions strictly restricted to saved source excerpts for that run." },
    { title: "Multi-Format Exports & Citations", desc: "Export PDF, Markdown (.md), Share Summary, and BibTeX / APA 7th / IEEE citations." },
    { title: "Responsive UI + Firebase Google Sign-In", desc: "3D hero scene (/landing.html), mobile-responsive login/dashboard views, Email/Password + Continue with Google (Firebase), and Demo Mode." },
  ];

  features.forEach((f) => {
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(ACCENT).text("• " + f.title);
    doc.font("Helvetica").fillColor(TEXT).text(f.desc, { indent: 12, lineGap: 2 });
    doc.moveDown(0.32);
  });

  doc.moveDown(0.5);

  // SECTION 5: TECH STACK & DEPLOYMENT
  doc.fontSize(14).font("Helvetica-Bold").fillColor(PERI).text("5. Technology Stack & Cloud Architecture");
  doc.moveDown(0.35);

  const stack = [
    ["Frontend (Vercel)", "React 18, TypeScript, Vite, @xyflow/react, Three.js 3D hero scene, Custom Responsive CSS"],
    ["Backend (Render)", "Node.js 22+, Express 5, TypeScript, Helmet, strict CORS, Rate Limiting, In-Process Scheduler"],
    ["Multi-Agent Engine", "@langchain/langgraph & @langchain/core (7-node workflow + controlled collector & diffing)"],
    ["AI & Search APIs", "Google Gemini Developer API (Flash-class), Tavily Search API, arXiv Open API"],
    ["Database", "MongoDB Atlas + Mongoose (users, workspaces, sourcesnapshots, researchruns, sources, claims, reports, agentevents)"],
    ["Authentication", "Email/Password (bcryptjs + JWT cookie/Bearer token) & Firebase Google Sign-In (RS256 certificate verification)"],
    ["Exports & Testing", "PDFKit, Markdown Report Builder, Citation Formatter; Vitest + Supertest (21 automated unit/eval/isolation tests)"],
  ];

  stack.forEach(([layer, tech]) => {
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#222244").text(layer + ": ", { continued: true });
    doc.font("Helvetica").fillColor(MUTED).text(tech, { lineGap: 2 });
    doc.moveDown(0.15);
  });

  doc.moveDown(0.8);

  // SECTION 6: HONEST LIMITATIONS & SUMMARY
  doc.rect(50, doc.y, 495, 86).fillAndStroke("#f5f4fd", "#d6d0f5");
  const boxTop = doc.y + 10;
  doc.fillColor(PERI).fontSize(10).font("Helvetica-Bold").text("Scope, Honest Limitations & Project Summary", 65, boxTop);
  doc.fillColor(TEXT).fontSize(8.8).font("Helvetica").text(
    "Built a full-stack multi-agent research and competitor-tracking platform using React, TypeScript, Node.js, Express, LangGraph.js, Gemini, Tavily, Firebase Auth, and MongoDB Atlas. The system collects approved public sources, compares versioned snapshots, performs deterministic quote verification separately from AI reasoning, enforces workspace/user isolation, and keeps human review in control.\n" +
    "Limitations: Does not bypass logins/CAPTCHAs/paywalls or render heavy JS-only SPAs; AI reasoning cannot guarantee ground truth; recurring schedules require a persistent server host.",
    65, boxTop + 16, { width: 465, lineGap: 2 }
  );

  doc.end();

  stream.on("finish", () => {
    console.log("PDF generated successfully at:", outputPath);
  });
}

buildPdf();
