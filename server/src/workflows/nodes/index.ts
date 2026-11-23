import { z } from "zod";
import { env } from "../../config/env";
import { Claim, Report, ResearchRun, Source } from "../../models";
import { generateJson } from "../../services/llm/gemini";
import { searchWeb, SearchHit } from "../../services/search/tavily";
import { searchArxiv } from "../../services/search/arxiv";
import { canonicalUrl, citedLabels, domainOf, excerptInSource, stripInvalidCitations } from "../../utils/evidence";
import { ClaimItem, ReportItem, SourceItem, State } from "../research.state";
import { enterStage, logEvent } from "./helpers";

type Update = Partial<State>;

const QUERY_COUNT = { quick: 3, standard: 4, deep: 6 } as const;
const MAX_EXCERPT = 1200;

/* ---------------- Planner ---------------- */
const planSchema = z.object({ queries: z.array(z.string().min(3).max(200)).min(1).max(8) });

export async function planQueries(s: State): Promise<Update> {
  await enterStage(s.runId, "planning", "Planner is writing search queries");
  const n = QUERY_COUNT[s.scope.depth];
  const out = await generateJson({
    schema: planSchema,
    system: "ROLE: Planner. Turn a research question into focused, diverse web search queries.",
    task: `Write exactly ${n} distinct search queries that together cover the question from different angles
(including at least one that could surface criticism or disagreement). Return {"queries": string[]}.`,
    data: { question: s.question, dateFrom: s.scope.dateFrom, dateTo: s.scope.dateTo },
  });
  const queries = [...new Set(out.queries.map((q) => q.trim()))].slice(0, n);
  await ResearchRun.updateOne({ _id: s.runId }, { searchQueries: queries });
  await logEvent(s.runId, "planning", `Planned ${queries.length} queries`);
  return { searchQueries: queries, currentStage: "planning" };
}

/* ---------------- Researcher (search tool) ---------------- */
interface RawHit extends SearchHit {
  query: string;
}

let lastHits: Map<string, RawHit[]> = new Map(); // per-run scratch between search and normalize

export async function searchNode(s: State): Promise<Update> {
  await enterStage(s.runId, "searching", "Searching live web and academic sources (Tavily + arXiv)");
  const perQuery = Math.max(3, Math.ceil(s.scope.maxSources / s.searchQueries.length) + 1);
  const hits: RawHit[] = [];
  const errors: string[] = [];

  // Query Tavily for broad web evidence
  for (const q of s.searchQueries) {
    try {
      const r = await searchWeb(q, {
        maxResults: Math.min(perQuery, 10),
        depth: s.scope.depth === "deep" ? "advanced" : "basic",
        dateFrom: s.scope.dateFrom,
        dateTo: s.scope.dateTo,
      });
      hits.push(...r.map((h) => ({ ...h, query: q })));
      await logEvent(s.runId, "searching", `"${q}" returned ${r.length} web results`);
    } catch (err) {
      const msg = `Search failed for "${q}": ${err instanceof Error ? err.message : "unknown error"}`;
      errors.push(msg);
      await logEvent(s.runId, "searching", msg, "warn");
    }
  }

  // Also query arXiv for scholarly papers
  try {
    const arxivHits = await searchArxiv(s.question, 4);
    if (arxivHits.length > 0) {
      hits.push(...arxivHits.map((h) => ({ ...h, query: "arXiv Peer-Reviewed Search" })));
      await logEvent(s.runId, "searching", `Retrieved ${arxivHits.length} peer-reviewed preprint(s) from arXiv`);
    }
  } catch (err) {
    console.error("arXiv stage warning:", err);
  }

  lastHits.set(s.runId, hits);
  return { errors, currentStage: "searching" };
}

/* ---------------- Normalizer ---------------- */
export async function normalizeSources(s: State): Promise<Update> {
  const hits = lastHits.get(s.runId) ?? [];
  lastHits.delete(s.runId);
  const seen = new Set<string>();
  const unique: (RawHit & { canonical: string })[] = [];
  for (const h of hits) {
    const canonical = canonicalUrl(h.url);
    if (!canonical || seen.has(canonical) || h.content.trim().length < 40) continue;
    seen.add(canonical);
    unique.push({ ...h, canonical });
  }
  const cap = Math.min(s.scope.maxSources, env.MAX_SOURCES_CAP);
  const chosen = unique.slice(0, cap);

  const docs = await Source.insertMany(
    chosen.map((h, i) => ({
      runId: s.runId,
      label: `S${i + 1}`,
      title: h.title || domainOf(h.url),
      url: h.url,
      canonicalUrl: h.canonical,
      domain: domainOf(h.url),
      publishedAt: h.publishedDate,
      excerpt: h.content.trim().slice(0, MAX_EXCERPT),
      contentType: "search_excerpt",
      searchQuery: h.query,
    }))
  );
  const sources: SourceItem[] = docs.map((d) => ({
    id: String(d._id),
    label: d.label,
    title: d.title ?? "",
    url: d.url,
    domain: d.domain ?? "",
    publishedAt: d.publishedAt ?? undefined,
    excerpt: d.excerpt ?? "",
  }));
  await ResearchRun.updateOne({ _id: s.runId }, { sourceCount: sources.length });
  const insufficient = sources.length < 2;
  await logEvent(
    s.runId,
    "searching",
    insufficient ? `Only ${sources.length} usable source(s) found. Stopping.` : `Kept ${sources.length} unique sources`,
    insufficient ? "warn" : "info"
  );
  return { sources, insufficient, currentStage: "searching" };
}

/* ---------------- Analyst ---------------- */
const analystSchema = z.object({
  themes: z.array(z.object({ name: z.string(), summary: z.string() })).default([]),
  claims: z
    .array(z.object({ text: z.string().min(8), sourceIds: z.array(z.string()).min(1), theme: z.string().optional() }))
    .max(30),
  disagreements: z.array(z.string()).default([]),
});

export async function analyseEvidence(s: State): Promise<Update> {
  await enterStage(s.runId, "analysing", "Analyst is extracting claims");
  const valid = new Set(s.sources.map((x) => x.label));
  const out = await generateJson({
    schema: analystSchema,
    system: "ROLE: Analyst. Extract atomic, testable factual claims from stored source excerpts.",
    task: `Read the sources and extract 8-20 atomic claims that help answer the question. Each claim must be one
concise testable statement and list the source IDs (e.g. "S1") whose excerpt supports it. Only use IDs present in DATA.
Also return themes (grouping) and "disagreements": places where sources conflict or differ.
Return {"themes":[{"name","summary"}],"claims":[{"text","sourceIds":[],"theme"}],"disagreements":[string]}.`,
    data: {
      question: s.question,
      sources: s.sources.map((x) => ({ id: x.label, title: x.title, domain: x.domain, publishedAt: x.publishedAt, excerpt: x.excerpt })),
    },
  });
  const claims: ClaimItem[] = [];
  let dropped = 0;
  for (const c of out.claims) {
    const labels = [...new Set(c.sourceIds.filter((id) => valid.has(id)))];
    if (!labels.length) {
      dropped++;
      continue;
    }
    claims.push({
      claimId: `clm_${String(claims.length + 1).padStart(3, "0")}`,
      text: c.text.trim(),
      theme: c.theme,
      sourceLabels: labels,
      evidence: [],
      limitations: [],
    });
  }
  const errors: string[] = [];
  if (dropped) {
    errors.push(`${dropped} claim(s) dropped because they cited unknown source IDs`);
    await logEvent(s.runId, "analysing", errors[0], "warn");
  }
  await logEvent(s.runId, "analysing", `Extracted ${claims.length} claims`);
  return { claims, themes: out.themes, disagreements: out.disagreements, insufficient: claims.length === 0, errors, currentStage: "analysing" };
}

/* ---------------- Verifier ---------------- */
const verifySchema = z.object({
  results: z.array(
    z.object({
      claimId: z.string(),
      status: z.enum(["supported", "contradicted", "mixed", "insufficient"]),
      evidence: z
        .array(z.object({ sourceId: z.string(), supportType: z.enum(["supports", "contradicts", "neutral"]), excerpt: z.string() }))
        .default([]),
      reasoning: z.string().default(""),
      limitations: z.array(z.string()).default([]),
    })
  ),
});

export async function verifyClaims(s: State): Promise<Update> {
  await enterStage(s.runId, "verifying", "Verifier is checking claims against stored evidence");
  const byLabel = new Map(s.sources.map((x) => [x.label, x]));
  const out = await generateJson({
    schema: verifySchema,
    system: "ROLE: Verifier. Judge each claim ONLY against the stored excerpts provided. Do not use outside knowledge.",
    task: `For every claim decide: supported (excerpts clearly back it), contradicted (excerpts clearly conflict),
mixed (sources disagree), or insufficient (excerpts do not settle it). Check ALL sources for contradicting evidence, not
only the cited ones. For each evidence item give the sourceId and an excerpt copied VERBATIM (short, under 200 chars)
from that source's excerpt. Note limitations (e.g. single source, old, secondary, snippet only).
Return {"results":[{"claimId","status","evidence":[{"sourceId","supportType","excerpt"}],"reasoning","limitations":[]}]}.`,
    data: {
      claims: s.claims.map((c) => ({ claimId: c.claimId, text: c.text, citedSources: c.sourceLabels })),
      sources: s.sources.map((x) => ({ id: x.label, domain: x.domain, publishedAt: x.publishedAt, excerpt: x.excerpt })),
    },
  });

  const errors: string[] = [];
  let badEvidence = 0;
  const resultById = new Map(out.results.map((r) => [r.claimId, r]));
  const claims: ClaimItem[] = s.claims.map((c) => {
    const r = resultById.get(c.claimId);
    if (!r) return { ...c, status: "insufficient", limitations: ["Verifier returned no result for this claim"] };
    const evidence = r.evidence.flatMap((e) => {
      const src = byLabel.get(e.sourceId);
      if (!src || !excerptInSource(e.excerpt, src.excerpt)) {
        badEvidence++;
        return [];
      }
      return [{ sourceLabel: src.label, sourceId: src.id, supportType: e.supportType, excerpt: e.excerpt.trim() }];
    });
    // A claim cannot be "supported/contradicted" without at least one verified excerpt.
    const status = evidence.length === 0 ? "insufficient" : r.status;
    return { ...c, status, evidence, reasoning: r.reasoning, limitations: r.limitations };
  });
  if (badEvidence) {
    errors.push(`${badEvidence} evidence excerpt(s) discarded because they did not appear in the stored source text`);
    await logEvent(s.runId, "verifying", errors[0], "warn");
  }
  await Claim.insertMany(claims.map((c) => ({ ...c, runId: s.runId })));
  const tally = claims.reduce<Record<string, number>>((a, c) => ((a[c.status!] = (a[c.status!] ?? 0) + 1), a), {});
  await logEvent(s.runId, "verifying", `Verification: ${JSON.stringify(tally)}`);
  return { claims, errors, currentStage: "verifying" };
}

/* ---------------- Report writer ---------------- */
const reportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string(), claimIds: z.array(z.string()).default([]) })).min(1),
  limitations: z.array(z.string()).default([]),
});

export async function writeReport(s: State): Promise<Update> {
  await enterStage(s.runId, "writing", "Report writer is drafting the cited report");
  const valid = new Set(s.sources.map((x) => x.label));
  const claimIds = new Set(s.claims.map((c) => c.claimId));
  const out = await generateJson({
    schema: reportSchema,
    system: "ROLE: Report writer. Write only from verified claims. Be precise about uncertainty.",
    task: `Write a research report answering the question. Rules:
- Cite sources inline as [S1], [S2] using only IDs in DATA. Every factual sentence needs a citation.
- State "supported" claims plainly. Describe "mixed" or "contradicted" claims as disputed. Do NOT present
  "insufficient" claims as fact; mention them only as open questions.
- 3-6 sections, each with claimIds it relies on. Include a "limitations" list (snippet-only evidence, dates, gaps).
Return {"title","summary","sections":[{"heading","body","claimIds":[]}],"limitations":[]}.`,
    data: {
      question: s.question,
      claims: s.claims.map((c) => ({
        claimId: c.claimId, text: c.text, status: c.status, reasoning: c.reasoning, limitations: c.limitations,
        evidenceSources: [...new Set(c.evidence.map((e) => e.sourceLabel))],
      })),
      disagreements: s.disagreements,
      sources: s.sources.map((x) => ({ id: x.label, title: x.title, domain: x.domain, publishedAt: x.publishedAt })),
    },
  });
  const report: ReportItem = {
    title: out.title,
    summary: stripInvalidCitations(out.summary, valid),
    sections: out.sections.map((sec) => ({
      heading: sec.heading,
      body: stripInvalidCitations(sec.body, valid),
      claimIds: sec.claimIds.filter((id) => claimIds.has(id)),
    })),
    limitations: [
      "Evidence is based on web search excerpts, not full articles, unless stated otherwise.",
      "Claim statuses are AI-assisted checks against stored excerpts, not guaranteed fact-checking. Review the sources.",
      ...out.limitations,
    ],
  };
  return { report, currentStage: "writing" };
}

/* ---------------- Save ---------------- */
export async function saveResult(s: State): Promise<Update> {
  let report = s.report;
  if (!report) {
    report = {
      title: "Not enough evidence to write a report",
      summary: "The search did not return enough usable sources to answer this question reliably. Try rewording the question, widening the date range, or using a deeper search.",
      sections: [],
      limitations: ["Fewer than two usable sources, or no verifiable claims, were found."],
    };
  }
  const all = [report.summary, ...report.sections.map((x) => x.body)].join(" ");
  await Report.create({
    runId: s.runId,
    ...report,
    themes: s.themes ?? [],
    disagreements: s.disagreements ?? [],
    referenceSourceIds: citedLabels(all),
  });
  await ResearchRun.updateOne(
    { _id: s.runId },
    { status: "completed", currentStage: "completed", completedAt: new Date(), warnings: s.errors ?? [] }
  );
  await logEvent(s.runId, "completed", "Research run completed");
  return { currentStage: "completed" };
}
