const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function buildPdf() {
  const outputPath = path.join(__dirname, "Evidence_Desk_Documentation.pdf");
  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
    info: {
      Title: "Evidence Desk — Project Documentation",
      Author: "Evidence Desk Multi-Agent Research Studio",
    },
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // PALETTE
  const NAVY = "#0d0830";
  const PERI = "#4b3bd6";
  const ACCENT = "#6f78ff";
  const TEXT = "#1e1e2f";
  const MUTED = "#555566";
  const OK = "#1b7f4b";

  // HEADER BANNER
  doc.rect(50, 45, 495, 80).fill("#140d3d");
  doc.fillColor("#ffffff").fontSize(22).font("Helvetica-Bold").text("Evidence Desk", 68, 62);
  doc.fontSize(11).font("Helvetica").fillColor("#c9b8ff").text("AI-Powered Multi-Agent Research Assistant — Complete Guide", 68, 92);

  doc.moveDown(4.5);
  doc.fillColor(TEXT);

  // SECTION 1: WHAT IS EVIDENCE DESK
  doc.fontSize(15).font("Helvetica-Bold").fillColor(PERI).text("1. What is Evidence Desk? (In Simple Words)");
  doc.moveDown(0.4);
  doc.fontSize(10).font("Helvetica").fillColor(TEXT).text(
    "When you ask standard chatbots (like ChatGPT or Gemini) a research question, they often produce persuasive essays with fabricated dates, numbers, or non-existent URLs.\n\n" +
    "Evidence Desk solves this by enforcing an 'Auditing Courtroom' architecture. Instead of writing from memory, it searches live websites and scientific repositories (arXiv), permanently saves each excerpt in a database, extracts individual factual claims, and uses an AI Verifier to confirm every claim with verbatim evidence. Every sentence in the final report has a clickable citation link jumping directly to the verified source text.",
    { lineGap: 3 }
  );

  doc.moveDown(1.2);

  // SECTION 2: PROBLEMS IT SOLVES
  doc.fontSize(15).font("Helvetica-Bold").fillColor(PERI).text("2. Key Problems Solved");
  doc.moveDown(0.4);

  const bullet = (title, desc) => {
    doc.fontSize(10).font("Helvetica-Bold").fillColor(ACCENT).text("• " + title + ": ", { continued: true });
    doc.font("Helvetica").fillColor(TEXT).text(desc, { lineGap: 2 });
  };

  bullet("Zero Hallucination Risk", "The AI model is forbidden from using outside unverified assumptions. Claims must match stored database text.");
  bullet("Complete Traceability", "Clicking any [S1], [S2] marker instantly displays the original website title, domain, crawl timestamp, and paragraph.");
  bullet("Academic Contradiction Radar", "When different papers disagree, it doesn't average them out. It flags conflicting evidence side-by-side.");
  bullet("Data Ownership & History", "All research runs, extracted claims, and references are permanently saved in your own MongoDB cloud database.");

  doc.moveDown(1.2);

  // SECTION 3: HOW IT WORKS (THE MULTI-AGENT PIPELINE)
  doc.fontSize(15).font("Helvetica-Bold").fillColor(PERI).text("3. How It Works (Step-by-Step Multi-Agent Workflow)");
  doc.moveDown(0.4);
  doc.fontSize(10).font("Helvetica").text(
    "Evidence Desk is powered by LangGraph.js, which orchestrates multiple autonomous agents acting like a team of human researchers:",
    { lineGap: 3 }
  );
  doc.moveDown(0.6);

  const steps = [
    { num: "Step 1: Planner Agent (Gemini)", txt: "Analyzes the question and breaks it down into 3 to 6 targeted search vectors." },
    { num: "Step 2: Searcher Tool (Tavily + arXiv)", txt: "Crawls both the live internet and scientific arXiv repositories for real-time sources." },
    { num: "Step 3: Normalizer", txt: "Cleans tracking parameters, deduplicates URLs, and saves text excerpts into MongoDB Atlas." },
    { num: "Step 4: Analyst Agent (Gemini)", txt: "Extracts 10-20 atomic, testable factual statements (claims) from the saved text." },
    { num: "Step 5: Verifier Agent (Gemini + Code Guardrails)", txt: "Labels each claim as Supported, Contradicted, or Mixed. Discards any non-verbatim excerpts." },
    { num: "Step 6: Report Writer Agent (Gemini)", txt: "Drafts a cited research report where every statement links strictly to verified evidence IDs." },
  ];

  steps.forEach(s => {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#222244").text(s.num);
    doc.font("Helvetica").fillColor(MUTED).text(s.txt, { indent: 14, lineGap: 2 });
    doc.moveDown(0.3);
  });

  // PAGE 2
  doc.addPage();

  doc.fontSize(15).font("Helvetica-Bold").fillColor(PERI).text("4. Built-In Features");
  doc.moveDown(0.4);

  const features = [
    { title: "Interactive Knowledge Graph", desc: "A 2D interactive node visualizer powered by React Flow showing how research questions link to claims and evidence." },
    { title: "Contradiction Radar", desc: "A dedicated matrix isolating contested claims and comparing competing perspectives from different sources." },
    { title: "Grounded Cross-Examine Chat", desc: "An audit chat mode where you can ask follow-ups. The AI is strictly bounded to the stored MongoDB sources." },
    { title: "Scholarly Citation Exporter", desc: "1-click generation of academic citations in BibTeX (.bib for LaTeX/Overleaf), APA 7th Edition, and IEEE formats." },
    { title: "Downloadable PDF Reports", desc: "Exports professional research summaries with an attached verified bibliography and limitations section." },
    { title: "Responsive Glassmorphic UI", desc: "Custom theme with high-legibility Inter typography, mobile hamburger drawer, and fluid viewport adaptation." },
  ];

  features.forEach(f => {
    doc.fontSize(10).font("Helvetica-Bold").fillColor(ACCENT).text("✓ " + f.title);
    doc.font("Helvetica").fillColor(TEXT).text(f.desc, { indent: 14, lineGap: 3 });
    doc.moveDown(0.4);
  });

  doc.moveDown(0.8);

  // SECTION 5: TECH STACK
  doc.fontSize(15).font("Helvetica-Bold").fillColor(PERI).text("5. Technology Stack (100% Free-Tier Architecture)");
  doc.moveDown(0.4);

  const stack = [
    ["Frontend Layer", "React 18, Vite, TypeScript, Custom Responsive Glassmorphic CSS"],
    ["Knowledge Graph", "@xyflow/react (React Flow) — Interactive browser-based node visualization"],
    ["Backend API", "Node.js 22+, Express 5, TypeScript, Cookie-Parser, Helmet, CORS"],
    ["Multi-Agent Engine", "@langchain/langgraph & @langchain/core — Stateful graph pipeline with conditional routing"],
    ["Primary AI Model", "Google Gemini Developer API (Eligible free-tier model)"],
    ["Live Web Search", "Tavily Search API — Researcher plan (1,000 free searches/month)"],
    ["Academic Search", "arXiv Open API — Public access to preprints and peer-reviewed papers"],
    ["Database", "MongoDB Atlas Free Cluster (512 MB storage) + Mongoose ODM"],
    ["Authentication", "JWT (JSON Web Tokens) in httpOnly cookies + bcryptjs password hashing"],
    ["Export Tools", "PDFKit (Backend PDF report generation) + Citation Formatter"],
  ];

  stack.forEach(([layer, tech]) => {
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#222244").text(layer + ": ", { continued: true });
    doc.font("Helvetica").fillColor(MUTED).text(tech, { lineGap: 2 });
  });

  doc.moveDown(1.2);

  // SECTION 6: RESUME / PORTFOLIO HIGHLIGHT
  doc.rect(50, doc.y, 495, 68).fillAndStroke("#f5f4fd", "#d6d0f5");
  const boxTop = doc.y + 10;
  doc.fillColor(PERI).fontSize(10.5).font("Helvetica-Bold").text("Resume Summary (For Students & Developers)", 65, boxTop);
  doc.fillColor(TEXT).fontSize(9).font("Helvetica").text(
    "Built a full-stack, stateful multi-agent research platform using React, Node.js, LangGraph.js, Gemini API, and MongoDB. " +
    "The system autonomously plans multi-vector search queries, crawls live web and arXiv academic sources, atomizes factual claims, " +
    "performs programmatic verbatim evidence checks to eliminate hallucinations, and produces cited, verifiable intelligence reports.",
    65, boxTop + 18, { width: 465, lineGap: 2 }
  );

  doc.end();

  stream.on("finish", () => {
    console.log("PDF generated successfully at:", outputPath);
  });
}

buildPdf();
