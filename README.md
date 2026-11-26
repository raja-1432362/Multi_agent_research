# Evidence Desk — Competitor, Market & Source-Backed Research Assistant

Evidence Desk helps small B2B product teams, founders, and researchers monitor competitor changes and answer market questions with inspectable source evidence. Every report links claims to saved source snapshots, separates deterministic quote matching from AI-assisted reasoning, highlights disagreements, flags collection failures or stale data visibly, and lets humans review or correct findings.

> **Human Decision Support Only:** Evidence Desk assists human research and review. It does not make business decisions on your behalf, and AI-assisted checks do not guarantee ground truth or eliminate errors. Always inspect the primary sources before acting.

---

## Core Workflows

### 1. Competitor & Market Watchlists (`Workspaces`)
- **Create a workspace** for a company, product category, or pricing study.
- **Add companies & approved public sources**:
  - Official company / product pages
  - Public documentation, release notes, and changelogs
  - Company blogs, press releases, and RSS / Atom feeds
  - Uploaded public text/markdown documents
- **Run manual or scheduled checks** (`Manual`, `Daily`, `Weekly`) subject to daily run caps.
- **Inspect "What Changed"**: The system computes a SHA-256 content hash and line diff against earlier snapshots (`New`, `Changed`, `Unchanged`, `Failed / Blocked`, `Stale`).
- **Failed checks stay visible**: If a page returns HTTP `401/403/429`, is disallowed by `robots.txt`, or is gated by a CAPTCHA/paywall, Evidence Desk records the failure openly and marks earlier snapshots as stale rather than presenting old data as fresh.

### 2. General Evidence-Grounded Research (`New research`)
- Ask an open question or optionally scope the run to a Workspace watchlist.
- View the live pipeline stages, interactive Knowledge Graph (`@xyflow/react`), Contradiction Radar, Grounded Cross-Examine Chat, and Citations (`BibTeX`, `APA`, `IEEE`), or export to **PDF** or **Markdown (`.md`)**.

### 3. Human Review & Corrections
- Inside any report, inspect every claim's two separate checks:
  1. **Code Quote Check**: Deterministic substring match confirming the quote exists verbatim in the saved snapshot text.
  2. **AI Meaning Check**: Evaluates whether the source actually supports, contradicts, or does not answer the claim (`Supported`, `Contradicted`, or `Not enough evidence`).
- Approve, flag, or edit any finding (`Correct / Add Note`) and export the updated report.

---

## Source Collection Rules & Limitations

- **Approved & public sources only**: Workspace collection fetches only approved public URLs, RSS/Atom feeds, uploaded documents, and (when `hybrid` mode is chosen) Tavily results restricted to approved competitor domains.
- **No access-control bypassing**: Evidence Desk never bypasses logins, CAPTCHAs, or paywalls. It checks `robots.txt` per RFC 9309 before fetching pages (remembering that `robots.txt` is a crawler preference signal, not legal permission).
- **SSRF protection**: Private network IPs, loopback addresses, metadata endpoints, and non-HTTP schemes are rejected.
- **Honest publication dates**: Publication dates are recorded **only** when explicitly provided by page metadata or feeds; otherwise they are stored as `null` and displayed as `Published: Unknown`. Retrieval timestamps are never used as publication dates.
- **No personal profiling**: Do not use Evidence Desk to scrape personal profiles or compile personal dossiers.
- **Prompt-injection defense**: Retrieved web text is stripped of obfuscating control characters and passed to Gemini strictly as untrusted passive `DATA` (following OWASP prompt-injection guidance). Model outputs are validated with Zod schemas and unknown source/claim IDs are discarded in TypeScript code.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, React Router, `@xyflow/react`, Three.js (`landing.html`)
- **Backend**: Node.js, Express 5, TypeScript, LangGraph.js (`@langchain/langgraph`), Zod, PDFKit
- **AI & Search**: Google Gemini Developer API (`@google/genai`), Tavily Search API, arXiv API
- **Database**: MongoDB Atlas + Mongoose (`users`, `workspaces`, `sourcesnapshots`, `researchruns`, `sources`, `claims`, `reports`, `agentevents`)
- **Testing**: Vitest + Supertest

---

## Setup & Running Locally

### Prerequisites
- Node.js `20+` (or `22+`)
- MongoDB Atlas free cluster (or local MongoDB instance)
- Google Gemini API key (Google AI Studio)
- Tavily API key

### Installation & Configuration
```bash
npm run install:all
cp server/.env.example server/.env
```

Fill in `server/.env`:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Random secret string (`16+` characters)
- `GEMINI_API_KEY` — Google AI Studio API key
- `GEMINI_MODEL` — Flash-class model available on your AI Studio quota (e.g. `gemini-2.5-flash` or `gemini-3-flash-preview`)
- `TAVILY_API_KEY` — Tavily API key
- `CLIENT_ORIGIN` — Frontend origin (default `http://localhost:5173`)
- `MAX_RUNS_PER_DAY` — Daily quota per user (default `5`)
- `MAX_SOURCES_CAP` — Max sources collected per run (default `15`)

*(Optional for separate frontend hosting such as Vercel)*: Set `VITE_API_URL=https://your-backend-url` in the frontend environment variables. Never put API keys into `VITE_*` variables.

### Run Development Servers & Tests
```bash
npm run dev:server   # Starts API & scheduler at http://localhost:5000
npm run dev:client   # Starts Vite UI at http://localhost:5173 (proxies /api)
npm test             # Runs server Vitest unit, collector, diff, evaluation & isolation tests
```

### Build Verification
```bash
npm --prefix server run typecheck && npm --prefix server run build
npm --prefix client run build
```

---

## What Remains Outside Scope / Cannot Be Guaranteed
- Evidence Desk **cannot** guarantee factual truth, catch every subtle nuance across JavaScript-heavy paywalled SPAs, or replace human legal/strategic review.
- Built-in scheduling runs in-process on the Express server (`scheduler.ts`) and assumes a persistent server host (e.g., Render/Railway/VM); serverless-only deployments will not trigger background cron intervals without an external trigger.
- No SSO, billing, multi-seat RBAC, or Slack/email alerting integrations are included in this release.
