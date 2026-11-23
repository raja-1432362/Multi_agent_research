# Evidence Desk — AI Multi-Agent Research Assistant
## Project Overview, Architecture & Guide

---

### 1. What is Evidence Desk? (In Simple Words)
When you ask standard AI chatbots (like ChatGPT or standard Gemini) a question, they write an essay that sounds smart, but they often **make up facts, hallucinate numbers, or give dead links**.

**Evidence Desk** is an intelligent research system designed to fix that problem completely.
Instead of guessing or writing from memory:
1. It searches the **live internet** and **academic repositories (arXiv)**.
2. It **saves and locks** every single web page it finds into a permanent database (MongoDB).
3. It breaks the topic down into small testable claims (facts).
4. An automated **AI Verifier** checks each claim against the saved website paragraphs. If an excerpt does not match word-for-word, it is thrown out.
5. It writes a structured research report where **every single fact has a clickable button `[S1]`, `[S2]` that opens the exact original evidence**.

---

### 2. What Problems Does It Solve?
- **No Hallucinations:** The system cannot invent facts because every claim must be backed by a saved source excerpt.
- **Traceable Citations:** You never have to wonder *"Where did this information come from?"* — you can click any claim to read the exact quotation.
- **Academic Disagreements:** If two different studies contradict each other, it doesn't average them out — it flags them in a **Contradiction Radar**.
- **Audit Trails:** All runs, sources, and claims are permanently stored in your own database.

---

### 3. How It Works (Step-by-Step Multi-Agent Pipeline)
Evidence Desk uses **LangGraph.js**, which orchestrates multiple specialized AI agents working together like a professional research team:

```
[User Question]
      │
      ▼
1. Planner Agent (Gemini)      ──> Breaks question into 3-6 smart search queries
      │
      ▼
2. Searcher Tool (Tavily + arXiv) ──> Fetches real-time web pages & peer-reviewed papers
      │
      ▼
3. Normalizer                  ──> Cleans URLs, removes duplicates & saves excerpts to MongoDB
      │
      ▼
4. Analyst Agent (Gemini)      ──> Extracts 10-20 atomic factual claims
      │
      ▼
5. Verifier Agent (Gemini)     ──> Verifies each claim against stored excerpts (Supported / Contradicted / Mixed)
      │
      ▼
6. Report Writer Agent (Gemini)──> Writes structured report with clickable inline citations
      │
      ▼
[Final Report + Knowledge Graph + Citations Export]
```

---

### 4. Key Features Built Into the App
1. **Interactive Knowledge Graph:** A 2D visual map powered by React Flow showing your research topic connected to verified claims and source links.
2. **Contradiction Radar:** An automated matrix isolating disputed facts where different websites disagree.
3. **Cross-Examine Chat Mode:** A follow-up chat where the AI is strictly forbidden from guessing — it answers *only* using your run's saved sources.
4. **Scholarly Citation Exporter:** 1-click export of your sources into standard **BibTeX** (for LaTeX/Overleaf), **APA 7th**, and **IEEE** formats.
5. **PDF Report Export:** Download a styled, clean PDF report with full bibliography.
6. **Responsive Dark/Violet Interface:** Built with clean, readable modern typography that works seamlessly on mobile phones and desktops.

---

### 5. Technology Stack (100% Free-Tier)
| Part | Technology | Role |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | Fast user interface |
| **Interactive Graph** | `@xyflow/react` (React Flow) | Node-based knowledge graph |
| **Backend** | Node.js + Express 5 + TypeScript | API server and background orchestrator |
| **Workflow Engine** | `@langchain/langgraph` | Multi-agent state machine |
| **Primary AI Model** | Gemini Developer API | Free-tier language model |
| **Live Web Search** | Tavily Search API | Search engine built for AI agents |
| **Academic Search** | arXiv Public API | Free repository of scientific papers |
| **Database** | MongoDB Atlas Free (M0) | Cloud database for saving evidence |
| **Authentication** | JWT + bcryptjs | Secure login and user account privacy |
| **Report Generation** | PDFKit | Generates downloadable research PDFs |

---

### 6. Summary for Your Resume / Portfolio
> **Title:** AI-Powered Multi-Agent Research Assistant (Evidence Desk)  
> **Description:** Developed a full-stack, stateful multi-agent research platform using React, Node.js, LangGraph.js, Gemini API, and MongoDB. The system autonomously plans multi-vector search queries, crawls live web and arXiv academic sources, atomizes factual claims, performs programmatic verbatim evidence checks to eliminate hallucinations, and produces cited, verifiable intelligence reports.
