import { z } from "zod";
import { env } from "../../config/env";
import { Claim, Report, ResearchRun, Source, SourceSnapshot, SourceType, Workspace } from "../../models";
import { collectApprovedSource } from "../../services/collector/collector";
import { generateJson } from "../../services/llm/gemini";
import { searchArxiv } from "../../services/search/arxiv";
import { searchWeb, SearchHit } from "../../services/search/tavily";
import {
  canonicalUrl,
  citedLabels,
  computeContentHash,
  diffSnapshots,
  domainOf,
  excerptInSource,
  isSafePublicUrl,
  sanitizeUntrustedText,
  stripInvalidCitations,
} from "../../utils/evidence";
import { ClaimItem, ReportItem, SourceItem, State } from "../research.state";
import { enterStage, logEvent } from "./helpers";

type Update = Partial<State>;

const QUERY_COUNT = { quick: 3, standard: 4, deep: 6 } as const;
const MAX_EXCERPT = 1800;

interface CollectedDraft {
  title: string;
  publisher: string;
  url: string;
  canonical: string;
  domain: string;
  publishedAt: string | null;
  retrievedAt: Date;
  content: string;
  sourceType: SourceType;
  isOfficial: boolean;
  contentHash: string;
  fetchStatus: "ok" | "failed" | "blocked" | "robots_disallowed";
  fetchError?: string;
  searchQuery: string;
}

const scratchHits = new Map<
  string,
  { items: CollectedDraft[]; attempted: number; failed: number; warnings: string[] }
>();

/* ---------------- 1. Planner ---------------- */
const planSchema = z.object({ queries: z.array(z.string().min(3).max(200)).min(1).max(8) });

export async function planQueries(s: State): Promise<Update> {
  await enterStage(s.runId, "planning", "Planner is turning the question into search targets");
  const n = QUERY_COUNT[s.scope.depth];

  let workspaceContext: Record<string, unknown> | undefined;
  if (s.workspaceId) {
    const ws = await Workspace.findOne({ _id: s.workspaceId, userId: s.userId });
    if (ws) {
      workspaceContext = {
        workspaceName: ws.name,
        competitors: ws.competitors.map((c) => ({ name: c.name, domain: c.domain })),
        approvedSourceLabels: ws.approvedSources.filter((src) => src.enabled).map((src) => `${src.label} (${src.sourceType})`),
      };
    }
  }

  const out = await generateJson({
    schema: planSchema,
    system: "ROLE: Planner. Turn a research or competitor-monitoring question into focused, diverse search queries.",
    task: `Write exactly ${n} distinct search queries covering the question from multiple angles (such as official announcements, pricing/product changes, documentation, and potential criticism or contradictions). Return {"queries": string[]}.`,
    data: {
      question: s.question,
      dateFrom: s.scope.dateFrom,
      dateTo: s.scope.dateTo,
      workspace: workspaceContext,
    },
  });

  const queries = [...new Set(out.queries.map((q) => q.trim()))].slice(0, n);
  await ResearchRun.updateOne({ _id: s.runId }, { searchQueries: queries });
  await logEvent(s.runId, "planning", `Planned ${queries.length} search targets`);
  return { searchQueries: queries, currentStage: "planning" };
}

/* ---------------- 2. Controlled Collector ---------------- */
export async function searchNode(s: State): Promise<Update> {
  await enterStage(s.runId, "searching", "Collector is fetching approved sources and permitted searches");
  const items: CollectedDraft[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let attempted = 0;
  let failed = 0;

  let approvedDomains: string[] = [];

  // Step A: Collect approved workspace sources directly via controlled collector
  if (s.workspaceId) {
    const ws = await Workspace.findOne({ _id: s.workspaceId, userId: s.userId });
    if (!ws) {
      const msg = "Workspace not found or access denied.";
      errors.push(msg);
      warnings.push(msg);
      await logEvent(s.runId, "searching", msg, "error");
      scratchHits.set(s.runId, { items, attempted, failed, warnings });
      return { errors, collectionWarnings: warnings, sourcesAttempted: 0, sourcesFailed: 0, currentStage: "searching" };
    }

    const enabledSources = ws.approvedSources.filter((src) => src.enabled);
    const maxReqs = Math.min(ws.limits?.maxRequestsPerRun ?? 12, env.MAX_SOURCES_CAP);
    approvedDomains = [
      ...new Set(
        [
          ...ws.competitors.map((c) => c.domain?.trim().toLowerCase().replace(/^www\./, "")),
          ...enabledSources.map((src) => src.domain?.trim().toLowerCase().replace(/^www\./, "")),
        ].filter((d): d is string => Boolean(d && d !== "uploaded-document"))
      ),
    ];

    for (const src of enabledSources.slice(0, maxReqs)) {
      attempted++;
      const collected = await collectApprovedSource({
        label: src.label,
        publisher: src.publisher || src.domain,
        url: src.url,
        sourceType: src.sourceType as SourceType,
        isOfficial: src.isOfficial,
        uploadedText: src.uploadedText ?? undefined,
      });

      if (collected.injectionSignals.length > 0) {
        const injMsg = `Prompt-injection pattern detected and neutralized in "${collected.label}" (${collected.injectionSignals.join(", ")}).`;
        warnings.push(injMsg);
        await logEvent(s.runId, "searching", injMsg, "warn");
      }

      if (collected.fetchStatus !== "ok") {
        failed++;
        const failMsg = `Source "${collected.label}" (${collected.url}) failed [${collected.fetchStatus}]: ${collected.fetchError ?? "Unavailable"}`;
        warnings.push(failMsg);
        errors.push(failMsg);
        await logEvent(s.runId, "searching", failMsg, "warn");
      } else {
        await logEvent(s.runId, "searching", `Collected approved source "${collected.label}" (${collected.sourceType})`);
      }

      items.push({
        title: collected.title,
        publisher: collected.publisher,
        url: collected.url,
        canonical: collected.canonicalUrl,
        domain: collected.domain,
        publishedAt: collected.publishedAt,
        retrievedAt: collected.retrievedAt,
        content: collected.normalizedText,
        sourceType: collected.sourceType,
        isOfficial: collected.isOfficial,
        contentHash: collected.contentHash,
        fetchStatus: collected.fetchStatus,
        fetchError: collected.fetchError,
        searchQuery: `Approved Watchlist (${collected.sourceType})`,
      });
    }
  }

  // Step B: Permitted Tavily search (restricted to approvedDomains when in workspace mode, or open web otherwise)
  const shouldSearchTavily = s.collectionMode !== "workspace_watchlist";
  if (shouldSearchTavily) {
    if (s.workspaceId && approvedDomains.length === 0 && items.filter((i) => i.fetchStatus === "ok").length > 0) {
      // Only uploaded/direct sources configured without domains; skip open search to stay controlled
      await logEvent(s.runId, "searching", "Using approved workspace sources directly (no open web domains configured)");
    } else {
      const perQuery = Math.max(3, Math.ceil(s.scope.maxSources / Math.max(1, s.searchQueries.length)) + 1);
      for (const q of s.searchQueries) {
        attempted++;
        try {
          const r: SearchHit[] = await searchWeb(q, {
            maxResults: Math.min(perQuery, 10),
            depth: s.scope.depth === "deep" ? "advanced" : "basic",
            dateFrom: s.scope.dateFrom,
            dateTo: s.scope.dateTo,
            includeDomains: s.workspaceId && approvedDomains.length > 0 ? approvedDomains : undefined,
          });
          for (const h of r) {
            if (!isSafePublicUrl(h.url)) continue;
            const canon = canonicalUrl(h.url);
            if (!canon) continue;
            const sanitized = sanitizeUntrustedText(h.content ?? "");
            if (sanitized.injectionDetected) {
              const injMsg = `Prompt-injection pattern detected and neutralized in web result "${h.title}" (${sanitized.signals.join(", ")}).`;
              warnings.push(injMsg);
              await logEvent(s.runId, "searching", injMsg, "warn");
            }
            const dom = domainOf(h.url);
            const isOfficial = approvedDomains.some((d) => dom === d || dom.endsWith(`.${d}`));
            items.push({
              title: h.title || dom,
              publisher: dom,
              url: h.url,
              canonical: canon,
              domain: dom,
              publishedAt: h.publishedDate ? h.publishedDate.slice(0, 10) : null,
              retrievedAt: new Date(),
              content: sanitized.text,
              sourceType: isOfficial ? "official_page" : "news",
              isOfficial,
              contentHash: computeContentHash(sanitized.text),
              fetchStatus: "ok",
              searchQuery: q,
            });
          }
          await logEvent(s.runId, "searching", `"${q}" returned ${r.length} permitted result(s)`);
        } catch (err) {
          failed++;
          const msg = `Search failed for "${q}": ${err instanceof Error ? err.message : "unknown error"}`;
          errors.push(msg);
          warnings.push(msg);
          await logEvent(s.runId, "searching", msg, "warn");
        }
      }
    }
  }

  // Step C: arXiv search only in general open_web research mode (not competitor pricing/release tracking)
  if (!s.workspaceId && s.collectionMode === "open_web") {
    try {
      const arxivHits = await searchArxiv(s.question, 4);
      if (arxivHits.length > 0) {
        for (const h of arxivHits) {
          const canon = canonicalUrl(h.url);
          if (!canon) continue;
          const sanitized = sanitizeUntrustedText(h.content);
          items.push({
            title: h.title,
            publisher: "arXiv",
            url: h.url,
            canonical: canon,
            domain: "arxiv.org",
            publishedAt: h.publishedDate ?? null,
            retrievedAt: new Date(),
            content: sanitized.text,
            sourceType: "academic",
            isOfficial: false,
            contentHash: computeContentHash(sanitized.text),
            fetchStatus: "ok",
            searchQuery: "arXiv Peer-Reviewed Search",
          });
        }
        await logEvent(s.runId, "searching", `Retrieved ${arxivHits.length} paper(s) from arXiv`);
      }
    } catch (err) {
      console.error("arXiv stage warning:", err);
    }
  }

  scratchHits.set(s.runId, { items, attempted, failed, warnings });
  return {
    errors,
    collectionWarnings: warnings,
    sourcesAttempted: attempted,
    sourcesFailed: failed,
    currentStage: "searching",
  };
}

/* ---------------- 3. Normalizer & Change Checker ---------------- */
export async function normalizeSources(s: State): Promise<Update> {
  const scratch = scratchHits.get(s.runId) ?? { items: [], attempted: 0, failed: 0, warnings: [] };
  scratchHits.delete(s.runId);

  const seen = new Set<string>();
  const uniqueOk: CollectedDraft[] = [];
  const failedItems: CollectedDraft[] = [];

  for (const h of scratch.items) {
    if (seen.has(h.canonical)) continue;
    if (h.fetchStatus !== "ok") {
      seen.add(h.canonical);
      failedItems.push(h);
      continue;
    }
    if (h.content.trim().length < 25) continue;
    seen.add(h.canonical);
    uniqueOk.push(h);
  }

  const cap = Math.min(s.scope.maxSources, env.MAX_SOURCES_CAP);
  const chosenOk = uniqueOk.slice(0, cap);

  const changesSummary: string[] = [];
  const warnings = [...(s.collectionWarnings ?? []), ...scratch.warnings];
  let snapshotsChanged = 0;

  const sourcesToInsert: Array<Record<string, unknown>> = [];

  // Process successful sources & compare snapshots if in a workspace
  for (let i = 0; i < chosenOk.length; i++) {
    const h = chosenOk[i];
    const label = `S${i + 1}`;
    let changeStatus: "new" | "changed" | "unchanged" = "new";
    let diffSummary = "Initial snapshot collected.";
    let snapshotId: unknown = undefined;

    if (s.workspaceId) {
      const prev = await SourceSnapshot.findOne({
        workspaceId: s.workspaceId,
        canonicalUrl: h.canonical,
        fetchStatus: "ok",
      }).sort({ retrievedAt: -1 });

      const diff = diffSnapshots(prev?.normalizedText, h.content);
      changeStatus = diff.changeStatus;
      diffSummary = diff.diffSummary;

      if (changeStatus === "changed") {
        snapshotsChanged++;
        changesSummary.push(`[${label}] ${h.title} (${h.domain}): ${diff.diffSummary}`);
      } else if (changeStatus === "new") {
        changesSummary.push(`[${label}] ${h.title} (${h.domain}): Baseline snapshot captured.`);
      }

      const snap = await SourceSnapshot.create({
        workspaceId: s.workspaceId,
        userId: s.userId,
        runId: s.runId,
        canonicalUrl: h.canonical,
        url: h.url,
        domain: h.domain,
        publisher: h.publisher,
        title: h.title,
        sourceType: h.sourceType,
        publishedAt: h.publishedAt,
        retrievedAt: h.retrievedAt,
        contentHash: h.contentHash,
        normalizedText: h.content,
        fetchStatus: "ok",
        changeStatus,
        diffSummary,
        addedLines: diff.addedLines,
        removedLines: diff.removedLines,
      });
      snapshotId = snap._id;
    }

    sourcesToInsert.push({
      runId: s.runId,
      workspaceId: s.workspaceId,
      snapshotId,
      label,
      title: h.title || h.domain,
      publisher: h.publisher || h.domain,
      url: h.url,
      canonicalUrl: h.canonical,
      domain: h.domain,
      publishedAt: h.publishedAt, // null when unknown
      retrievedAt: h.retrievedAt,
      excerpt: h.content.trim().slice(0, MAX_EXCERPT),
      contentType: h.sourceType === "user_upload" ? "uploaded_document" : h.sourceType === "rss_feed" ? "rss_feed" : "extracted_page",
      sourceType: h.sourceType,
      isOfficial: h.isOfficial,
      contentHash: h.contentHash,
      fetchStatus: "ok",
      changeStatus,
      diffSummary,
      searchQuery: h.searchQuery,
    });
  }

  // Record failed/blocked workspace checks visibly (never pretend old data is fresh!)
  if (s.workspaceId && failedItems.length > 0) {
    for (let j = 0; j < failedItems.length; j++) {
      const f = failedItems[j];
      const prev = await SourceSnapshot.findOne({
        workspaceId: s.workspaceId,
        canonicalUrl: f.canonical,
        fetchStatus: "ok",
      }).sort({ retrievedAt: -1 });

      const staleNote = prev
        ? `Previous snapshot from ${prev.retrievedAt.toISOString().slice(0, 10)} is OUTDATED/STALE because the latest check failed (${f.fetchStatus}).`
        : "No prior snapshot exists.";

      await SourceSnapshot.create({
        workspaceId: s.workspaceId,
        userId: s.userId,
        runId: s.runId,
        canonicalUrl: f.canonical,
        url: f.url,
        domain: f.domain,
        publisher: f.publisher,
        title: f.title,
        sourceType: f.sourceType,
        publishedAt: null,
        retrievedAt: f.retrievedAt,
        fetchStatus: f.fetchStatus,
        fetchError: f.fetchError,
        changeStatus: prev ? "stale_fallback" : "failed",
        diffSummary: `${f.fetchError ?? "Collection failed."} ${staleNote}`,
      });

      const warnMsg = `${f.title} (${f.url}) could not be collected (${f.fetchStatus}): ${f.fetchError ?? "Unavailable"}. ${staleNote}`;
      if (!warnings.includes(warnMsg)) warnings.push(warnMsg);
    }
  }

  const docs = sourcesToInsert.length ? await Source.insertMany(sourcesToInsert) : [];
  const sources: SourceItem[] = docs.map((d) => ({
    id: String(d._id),
    label: String(d.label ?? ""),
    title: String(d.title ?? ""),
    publisher: d.publisher ? String(d.publisher) : undefined,
    url: String(d.url ?? ""),
    domain: String(d.domain ?? ""),
    publishedAt: d.publishedAt ? String(d.publishedAt) : null,
    retrievedAt: d.retrievedAt instanceof Date ? d.retrievedAt.toISOString() : undefined,
    excerpt: String(d.excerpt ?? ""),
    sourceType: (d.sourceType ?? "search_excerpt") as SourceType,
    isOfficial: Boolean(d.isOfficial),
    contentHash: d.contentHash ? String(d.contentHash) : undefined,
    fetchStatus: (d.fetchStatus ?? "ok") as "ok" | "failed" | "blocked" | "robots_disallowed",
    fetchError: d.fetchError ? String(d.fetchError) : undefined,
    changeStatus: (d.changeStatus ?? "new") as "new" | "changed" | "unchanged" | "failed" | "stale_fallback",
    diffSummary: d.diffSummary ? String(d.diffSummary) : undefined,
  }));

  await ResearchRun.updateOne({ _id: s.runId }, { sourceCount: sources.length });

  const minRequired = s.workspaceId ? 1 : 2;
  const insufficient = sources.length < minRequired;

  await logEvent(
    s.runId,
    "searching",
    insufficient
      ? `Only ${sources.length} usable source(s) collected (${failedItems.length} failed/blocked). Stopping.`
      : `Collected ${sources.length} unique source(s); ${snapshotsChanged} changed snapshot(s); ${failedItems.length} failed/blocked.`,
    insufficient || failedItems.length > 0 ? "warn" : "info"
  );

  return {
    sources,
    insufficient,
    changesSummary,
    collectionWarnings: [...new Set(warnings)],
    snapshotsChanged,
    currentStage: "searching",
  };
}

/* ---------------- 4. Analyst ---------------- */
const analystSchema = z.object({
  themes: z.array(z.object({ name: z.string(), summary: z.string() })).default([]),
  claims: z
    .array(z.object({ text: z.string().min(8), sourceIds: z.array(z.string()).min(1), theme: z.string().optional() }))
    .max(30),
  disagreements: z.array(z.string()).default([]),
});

export async function analyseEvidence(s: State): Promise<Update> {
  await enterStage(s.runId, "analysing", "Analyst is extracting testable claims and change highlights");
  const valid = new Set(s.sources.map((x) => x.label));

  const out = await generateJson({
    schema: analystSchema,
    system: "ROLE: Analyst. Extract atomic, testable factual claims from stored source excerpts and snapshot diffs.",
    task: `Read the sources and extract 6-18 concise, testable claims that help answer the question.
Rules:
- Each claim must list the source IDs (e.g. "S1") whose excerpt supports it. Only use IDs present in DATA.
- Pay special attention to product changes, pricing updates, release notes, policy/documentation changes, and dates (if publishedAt is null, do NOT guess a date).
- Prefer official sources when available, and highlight any disagreements between sources.
Return {"themes":[{"name","summary"}],"claims":[{"text","sourceIds":[],"theme"}],"disagreements":[string]}.`,
    data: {
      question: s.question,
      detectedChanges: s.changesSummary,
      sources: s.sources.map((x) => ({
        id: x.label,
        title: x.title,
        publisher: x.publisher,
        domain: x.domain,
        sourceType: x.sourceType,
        isOfficial: x.isOfficial,
        publishedAt: x.publishedAt ?? "Unknown",
        retrievedAt: x.retrievedAt,
        changeStatus: x.changeStatus,
        diffSummary: x.diffSummary,
        excerpt: x.excerpt,
      })),
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
      codeVerified: false,
      evidence: [],
      limitations: [],
    });
  }

  const errors: string[] = [];
  if (dropped) {
    errors.push(`${dropped} claim(s) dropped because they cited unknown source IDs`);
    await logEvent(s.runId, "analysing", errors[0], "warn");
  }
  await logEvent(s.runId, "analysing", `Extracted ${claims.length} atomic claims`);
  return {
    claims,
    themes: out.themes,
    disagreements: out.disagreements,
    insufficient: claims.length === 0,
    errors,
    currentStage: "analysing",
  };
}

/* ---------------- 5. Verifier (Code Quote Check + AI Meaning Check) ---------------- */
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
  await enterStage(s.runId, "verifying", "Verifier is running code quote match and meaning checks");
  const byLabel = new Map(s.sources.map((x) => [x.label, x]));

  const out = await generateJson({
    schema: verifySchema,
    system: "ROLE: Verifier. Judge each claim ONLY against the stored excerpts provided. Do not use outside knowledge.",
    task: `For every claim perform a strict meaning check:
- supported: excerpts directly back it (prefer official sources when they directly support it).
- contradicted / mixed: sources conflict or contradict each other; keep disagreements visible.
- insufficient: excerpts do not settle the claim.
For each evidence item provide sourceId and an exact VERBATIM quote (under 220 chars) copied directly from that source's excerpt.
Note limitations honestly (e.g., unknown publication date, single third-party source, truncated excerpt).
Return {"results":[{"claimId","status","evidence":[{"sourceId","supportType","excerpt"}],"reasoning","limitations":[]}]}.`,
    data: {
      claims: s.claims.map((c) => ({ claimId: c.claimId, text: c.text, citedSources: c.sourceLabels })),
      sources: s.sources.map((x) => ({
        id: x.label,
        domain: x.domain,
        sourceType: x.sourceType,
        isOfficial: x.isOfficial,
        publishedAt: x.publishedAt ?? "Unknown",
        excerpt: x.excerpt,
      })),
    },
  });

  const errors: string[] = [];
  let badEvidence = 0;
  let totalQuotesChecked = 0;
  let matchedQuotes = 0;

  const resultById = new Map(out.results.map((r) => [r.claimId, r]));
  const claims: ClaimItem[] = s.claims.map((c) => {
    const r = resultById.get(c.claimId);
    if (!r) {
      return {
        ...c,
        status: "insufficient",
        codeVerified: false,
        limitations: ["Verifier returned no evaluation for this claim."],
      };
    }

    // Separate deterministic CODE CHECK: confirms displayed quote exists verbatim in saved source text
    const evidence = r.evidence.flatMap((e) => {
      totalQuotesChecked++;
      const src = byLabel.get(e.sourceId);
      if (!src || !excerptInSource(e.excerpt, src.excerpt)) {
        badEvidence++;
        return [];
      }
      matchedQuotes++;
      return [{ sourceLabel: src.label, sourceId: src.id, supportType: e.supportType, excerpt: e.excerpt.trim() }];
    });

    const codeVerified = evidence.length > 0;
    // A claim without at least one code-verified excerpt cannot be marked supported or contradicted
    const status = !codeVerified ? "insufficient" : r.status;
    const extraLimitation = !codeVerified ? ["No verbatim quote matched the saved source text."] : [];

    return {
      ...c,
      status,
      codeVerified,
      evidence,
      reasoning: r.reasoning,
      limitations: [...r.limitations, ...extraLimitation],
    };
  });

  const quoteMatchRate = totalQuotesChecked > 0 ? Number((matchedQuotes / totalQuotesChecked).toFixed(3)) : 0;

  if (badEvidence) {
    errors.push(`${badEvidence} evidence quote(s) failed deterministic substring check and were discarded`);
    await logEvent(s.runId, "verifying", errors[0], "warn");
  }
  await Claim.insertMany(
    claims.map((c) => ({
      ...c,
      runId: s.runId,
      humanReview: { status: "unreviewed" },
    }))
  );
  const tally = claims.reduce<Record<string, number>>((a, c) => ((a[c.status!] = (a[c.status!] ?? 0) + 1), a), {});
  await logEvent(s.runId, "verifying", `Verification complete (${Math.round(quoteMatchRate * 100)}% verbatim quote match): ${JSON.stringify(tally)}`);

  return { claims, quoteMatchRate, errors, currentStage: "verifying" };
}

/* ---------------- 6. Report Writer ---------------- */
const reportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string(), claimIds: z.array(z.string()).default([]) })).min(1),
  limitations: z.array(z.string()).default([]),
});

export async function writeReport(s: State): Promise<Update> {
  await enterStage(s.runId, "writing", "Report writer is drafting the concise cited report");
  const valid = new Set(s.sources.map((x) => x.label));
  const claimIds = new Set(s.claims.map((c) => c.claimId));

  const out = await generateJson({
    schema: reportSchema,
    system: "ROLE: Report writer. Draft a concise, neutral, human-reviewable briefing strictly from verified claims and snapshot changes.",
    task: `Write a short, clear briefing answering the question for a product/research team.
Rules:
- Cite sources inline as [S1], [S2] using only IDs in DATA.
- Do NOT make business recommendations or decide strategy for the user; present evidence for human decision-making.
- Clearly note what changed vs earlier snapshots if changes exist, and highlight disagreements without averaging conflicting views.
- Mention "insufficient" claims only as open gaps/questions. Mention when publication dates are unknown.
- 2-5 short sections, each listing the claimIds it relies on.
Return {"title","summary","sections":[{"heading","body","claimIds":[]}],"limitations":[]}.`,
    data: {
      question: s.question,
      changesSummary: s.changesSummary,
      collectionWarnings: s.collectionWarnings,
      claims: s.claims.map((c) => ({
        claimId: c.claimId,
        text: c.text,
        status: c.status,
        codeVerified: c.codeVerified,
        reasoning: c.reasoning,
        limitations: c.limitations,
        evidenceSources: [...new Set(c.evidence.map((e) => e.sourceLabel))],
      })),
      disagreements: s.disagreements,
      sources: s.sources.map((x) => ({
        id: x.label,
        title: x.title,
        publisher: x.publisher,
        domain: x.domain,
        sourceType: x.sourceType,
        isOfficial: x.isOfficial,
        publishedAt: x.publishedAt ?? "Unknown",
        retrievedAt: x.retrievedAt,
        changeStatus: x.changeStatus,
      })),
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
    changesSummary: s.changesSummary ?? [],
    collectionWarnings: s.collectionWarnings ?? [],
    limitations: [
      "Evidence reflects captured public excerpts/snapshots at retrieval time, not necessarily complete gated sites.",
      "Claim checks are AI-assisted evaluations paired with automated substring matching; a matching quote does not guarantee ground truth. Review primary sources before acting.",
      ...out.limitations,
    ],
  };

  return { report, currentStage: "writing" };
}

/* ---------------- 7. Save & Metrics ---------------- */
export async function saveResult(s: State): Promise<Update> {
  let report = s.report;
  const warnings = s.collectionWarnings ?? [];
  if (!report) {
    report = {
      title: "Not enough usable evidence to write a report",
      summary:
        "The controlled collector did not obtain enough accessible public sources to answer this question reliably. Review any collection errors below, verify approved source URLs, or adjust your search scope.",
      sections: [],
      changesSummary: s.changesSummary ?? [],
      collectionWarnings: warnings,
      limitations: [
        "Too few accessible sources or no verifiable claims were obtained.",
        ...warnings,
      ],
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

  const durationMs = Math.max(0, Date.now() - (s.startedAtMs || Date.now()));
  await ResearchRun.updateOne(
    { _id: s.runId },
    {
      status: "completed",
      currentStage: "completed",
      completedAt: new Date(),
      warnings: [...new Set([...(s.errors ?? []), ...warnings])],
      metrics: {
        durationMs,
        sourcesAttempted: s.sourcesAttempted ?? 0,
        sourcesFailed: s.sourcesFailed ?? 0,
        snapshotsChanged: s.snapshotsChanged ?? 0,
        quoteMatchRate: s.quoteMatchRate ?? 0,
        humanCorrectionsCount: 0,
      },
    }
  );

  if (s.workspaceId) {
    const ws = await Workspace.findById(s.workspaceId);
    if (ws) {
      const now = new Date();
      let nextRunAt: Date | undefined;
      if (ws.schedule?.cadence === "daily") nextRunAt = new Date(now.getTime() + 864e5);
      else if (ws.schedule?.cadence === "weekly") nextRunAt = new Date(now.getTime() + 7 * 864e5);
      await Workspace.updateOne(
        { _id: ws._id },
        { "schedule.lastRunAt": now, ...(nextRunAt ? { "schedule.nextRunAt": nextRunAt } : {}) }
      );
    }
  }

  await logEvent(s.runId, "completed", `Research run completed in ${(durationMs / 1000).toFixed(1)}s`);
  return { currentStage: "completed" };
}
