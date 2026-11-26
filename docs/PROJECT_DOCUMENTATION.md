# Evidence Desk — Competitor Intelligence & Research Assistant
## Updated Project Overview, Architecture & User Guide

---

### 1. What is Evidence Desk? (In Plain Words)
Standard AI chatbots often generate smooth answers with fabricated dates, stale details, or unverified links, and they hide when sources disagree.

**Evidence Desk** is built for small B2B product teams, founders, and researchers to track competitor and market changes with inspectable evidence:
1. **Monitor approved public sources** in isolated **Workspaces**: official company/product pages, pricing pages, public documentation, release notes/changelogs, company blogs, RSS/Atom feeds, and uploaded public documents.
2. **Respect access rules**: checks `robots.txt` (RFC 9309), blocks private/local SSRF URLs, and never bypasses logins, CAPTCHAs, or paywalls.
3. **Detect what changed**: compares new collected text against earlier snapshots using SHA-256 hashes and line diffs (`New`, `Changed`, `Unchanged`, `Failed`, or `Stale`).
4. **Separate two evidence checks**:
   - **Code Quote Check**: verifies in TypeScript code that the displayed quote appears verbatim in the saved source text.
   - **AI Meaning Check**: evaluates whether the quote supports, contradicts, or lacks evidence (`Supported`, `Contradicted`, `Not enough evidence`).
5. **Keep humans in control**: Evidence Desk never makes business decisions on your behalf. Users can inspect every citation, review disagreements, approve or correct findings, and export **PDF**, **Markdown (`.md`)**, or scholarly citations (**BibTeX**, **APA**, **IEEE**).

---

### 2. Multi-Agent Workflow (`LangGraph.js`)

```
[Workspace Watchlist or Research Question]
      │
      ▼
1. Planner Agent (Gemini)        ──> Creates 3–6 focused queries & targets
      │
      ▼
2. Controlled Collector          ──> Fetches approved URLs, RSS, uploaded docs
   (RFC 9309 + Tavily + arXiv)       (or domain-scoped / open web searches)
      │
      ▼
3. Normalizer & Change Checker   ──> Deduplicates URLs, saves SourceSnapshots,
                                     computes SHA-256 diffs & flags failures
      │
      ▼
4. Analyst Agent (Gemini)        ──> Extracts atomic testable claims & disagreements
      │
      ▼
5. Dual Verifier                 ──> Code substring check + AI meaning verdict
      │
      ▼
6. Report Writer & Save          ──> Briefing with citations, unknown-date flags,
                                     changes summary, warnings & run metrics
```

---

### 3. Key Features Built Into the App
1. **Competitor Workspaces (`Watchlists`)**: Add competitors, approved URLs/feeds/uploads, and optional recurring checks (`Manual`, `Daily`, `Weekly`).
2. **What Changed Timeline**: View line-by-line additions/removals across snapshots, plus clear notices whenever a source failed or returned blocked/stale status.
3. **Human Review & Corrections**: Approve, flag, or edit any claim (`Correct / Add Note`) directly on the report page.
4. **Interactive Knowledge Graph (`@xyflow/react`)**: Explore topics, claims, and status connections visually.
5. **Contradiction Radar**: Inspect contested claims where sources disagree side-by-side.
6. **Grounded Cross-Examine Chat**: Ask follow-ups strictly bounded to saved sources from that run.
7. **Flexible Authentication & Cloud Hosting**:
   - Email/Password (`bcryptjs` + HTTP-only cookie & Bearer JWT)
   - **Continue with Google** via Firebase Auth (verified on the backend using Google's RS256 x509 public keys)
   - Instant Demo Mode (clearly labeled sample data)
   - Frontend hosted on **Vercel**, Backend & Scheduler on **Render**, Database on **MongoDB Atlas**.

---

### 4. Technology Stack
| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript, Custom Responsive CSS | Responsive desktop & mobile UI + 3D landing page |
| **Knowledge Graph** | `@xyflow/react` | Interactive topic-to-claim topology |
| **Backend** | Node.js 22+, Express 5, TypeScript, Zod | Auth, workspace isolation, scheduler & API |
| **Workflow Engine** | `@langchain/langgraph` | Stateful multi-agent pipeline |
| **AI & Search** | Google Gemini API, Tavily Search, arXiv API | Planning, claim analysis, verification & reporting |
| **Authentication** | JWT + bcryptjs + Firebase Auth (Google) | Secure account access & workspace ownership |
| **Database** | MongoDB Atlas + Mongoose | Workspaces, snapshots, runs, sources, claims, reports |
| **Exports & Testing** | PDFKit, Markdown Builder, Vitest + Supertest | Export reports & 21 automated tests |

---

### 5. Honest Limitations & What Cannot Be Guaranteed
- Evidence Desk provides **AI-assisted checks and substring quote matching**, not guaranteed ground truth. Always inspect the linked primary sources before making product or business decisions.
- Publication dates are displayed **only** when explicitly provided by the page or feed (`Published: Unknown` otherwise).
- Sites requiring login, solving CAPTCHAs, behind paywalls, or relying purely on heavy client-side JS are not bypassed and will report collection failures openly.
- Built-in recurring schedules require a persistent Node host (such as Render) and adhere to daily per-user run quotas.
