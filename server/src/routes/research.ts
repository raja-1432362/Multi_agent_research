import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { AgentEvent, Claim, Report, ResearchRun, Source, SourceSnapshot, TERMINAL, Workspace } from "../models";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { claimReviewSchema, createRunSchema } from "../validators/schemas";
import { env } from "../config/env";
import { resetRun, runResearch } from "../workflows/research.graph";
import { streamReportPdf } from "../services/reports/pdf";
import { buildReportMarkdown } from "../services/reports/markdown";

export const researchRouter = Router();
researchRouter.use(requireAuth);

/** Ownership check used by every :id route. */
async function ownedRun(userId: string | undefined, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Research run not found");
  const run = await ResearchRun.findOne({ _id: id, userId });
  if (!run) throw new HttpError(404, "Research run not found");
  return run;
}

researchRouter.post("/", async (req, res) => {
  const body = createRunSchema.parse(req.body);
  let workspaceId: string | undefined;
  let collectionMode = body.collectionMode ?? "open_web";

  if (body.workspaceId) {
    if (!isValidObjectId(body.workspaceId)) throw new HttpError(404, "Workspace not found");
    const ws = await Workspace.findOne({ _id: body.workspaceId, userId: req.userId });
    if (!ws) throw new HttpError(404, "Workspace not found");
    workspaceId = String(ws._id);
    if (!body.collectionMode) collectionMode = "hybrid";
  }

  const since = new Date(Date.now() - 864e5);
  const used = await ResearchRun.countDocuments({ userId: req.userId, createdAt: { $gte: since } });
  if (used >= env.MAX_RUNS_PER_DAY) {
    throw new HttpError(429, `Daily limit of ${env.MAX_RUNS_PER_DAY} research runs reached. This protects the free API quotas.`);
  }

  const run = await ResearchRun.create({
    userId: req.userId,
    workspaceId,
    triggerType: "manual",
    collectionMode,
    question: body.question,
    scope: { depth: body.depth, maxSources: body.maxSources, dateFrom: body.dateFrom, dateTo: body.dateTo },
  });
  void runResearch(String(run._id));
  res.status(202).json(run);
});

researchRouter.get("/", async (req, res) => {
  const filter: Record<string, unknown> = { userId: req.userId };
  if (req.query.workspaceId && typeof req.query.workspaceId === "string" && isValidObjectId(req.query.workspaceId)) {
    filter.workspaceId = req.query.workspaceId;
  }
  const runs = await ResearchRun.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json(runs);
});

researchRouter.get("/:id", async (req, res) => {
  res.json(await ownedRun(req.userId, req.params.id));
});

researchRouter.get("/:id/events", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  res.json(await AgentEvent.find({ runId: run._id }).sort({ timestamp: 1 }));
});

researchRouter.get("/:id/sources", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const sources = await Source.find({ runId: run._id }).sort({ label: 1 });
  res.json(sources.sort((a, b) => Number(a.label.slice(1)) - Number(b.label.slice(1))));
});

researchRouter.get("/:id/claims", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  res.json(await Claim.find({ runId: run._id }).sort({ claimId: 1 }));
});

researchRouter.patch("/:id/claims/:claimId/review", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const body = claimReviewSchema.parse(req.body);
  if (body.status === "corrected" && (!body.correctedText || body.correctedText.length < 4)) {
    throw new HttpError(400, "Provide corrected wording when marking a finding as corrected.");
  }

  const claim = await Claim.findOne({ runId: run._id, claimId: req.params.claimId });
  if (!claim) throw new HttpError(404, "Claim not found");

  claim.humanReview = {
    status: body.status,
    note: body.note,
    correctedText: body.status === "corrected" ? body.correctedText : undefined,
    reviewedAt: new Date(),
  };
  await claim.save();

  const correctionsCount = await Claim.countDocuments({
    runId: run._id,
    "humanReview.status": { $in: ["corrected", "flagged"] },
  });
  await ResearchRun.updateOne({ _id: run._id }, { "metrics.humanCorrectionsCount": correctionsCount });
  await AgentEvent.create({
    runId: run._id,
    stage: "human_review",
    message: `Human review updated ${claim.claimId} to "${body.status}"`,
    level: "info",
  });

  res.json(claim);
});

researchRouter.get("/:id/report", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const report = await Report.findOne({ runId: run._id });
  if (!report) throw new HttpError(404, "Report is not ready yet");
  res.json(report);
});

researchRouter.get("/:id/report.md", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const report = await Report.findOne({ runId: run._id });
  if (!report) throw new HttpError(404, "Report is not ready yet");
  const [sources, claims] = await Promise.all([
    Source.find({ runId: run._id }),
    Claim.find({ runId: run._id }).sort({ claimId: 1 }),
  ]);
  sources.sort((a, b) => Number(a.label.slice(1)) - Number(b.label.slice(1)));

  const md = buildReportMarkdown({
    question: run.question,
    createdAt: run.createdAt,
    report: {
      title: report.title,
      summary: report.summary,
      sections: report.sections,
      changesSummary: report.changesSummary,
      collectionWarnings: report.collectionWarnings,
      disagreements: report.disagreements,
      limitations: report.limitations,
    },
    claims: claims.map((c) => ({
      claimId: c.claimId,
      text: c.text,
      status: c.status,
      codeVerified: c.codeVerified,
      reasoning: c.reasoning,
      humanReview: c.humanReview,
      evidence: c.evidence,
    })),
    sources: sources.map((s) => ({
      label: s.label,
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      sourceType: s.sourceType,
      isOfficial: s.isOfficial,
      publishedAt: s.publishedAt,
      retrievedAt: s.retrievedAt,
      changeStatus: s.changeStatus,
    })),
  });

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="evidence-desk-report.md"');
  res.send(md);
});

researchRouter.get("/:id/report.pdf", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const report = await Report.findOne({ runId: run._id });
  if (!report) throw new HttpError(404, "Report is not ready yet");
  const sources = await Source.find({ runId: run._id });
  sources.sort((a, b) => Number(a.label.slice(1)) - Number(b.label.slice(1)));
  streamReportPdf(res, {
    question: run.question,
    report: {
      title: report.title,
      summary: report.summary,
      sections: report.sections,
      changesSummary: report.changesSummary,
      collectionWarnings: report.collectionWarnings,
      limitations: report.limitations,
      disagreements: report.disagreements,
    },
    sources: sources.map((s) => ({
      label: s.label,
      title: s.title,
      url: s.url,
      publishedAt: s.publishedAt,
      retrievedAt: s.retrievedAt,
      sourceType: s.sourceType,
      isOfficial: s.isOfficial,
    })),
  });
});

researchRouter.post("/:id/retry", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  if (run.status !== "failed" && run.status !== "cancelled") throw new HttpError(409, "Only failed or cancelled runs can be retried");
  await resetRun(String(run._id));
  void runResearch(String(run._id));
  res.status(202).json(await ResearchRun.findById(run._id));
});

researchRouter.post("/:id/cancel", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  if (TERMINAL.includes(run.status)) throw new HttpError(409, "This run has already finished");
  run.status = "cancelled";
  run.completedAt = new Date();
  await run.save();
  res.json(run);
});

researchRouter.post("/:id/chat", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const question = String(req.body?.question || "").trim();
  if (!question) throw new HttpError(400, "Question is required");

  const [sources, claims, report] = await Promise.all([
    Source.find({ runId: run._id }),
    Claim.find({ runId: run._id }),
    Report.findOne({ runId: run._id }),
  ]);

  const { generateJson } = await import("../services/llm/gemini.js");
  const { z } = await import("zod");

  const chatSchema = z.object({
    answer: z.string(),
    citedSourceLabels: z.array(z.string()).default([]),
    unsupportedOrMissing: z.boolean().default(false),
  });

  const reply = await generateJson({
    schema: chatSchema,
    system: `You are an Evidence Desk Cross-Examination Auditor.
Answer the user's question STRICTLY and ONLY using the evidence provided in DATA.
Rules:
- If the question cannot be answered from the provided excerpts, set answer to "This topic was not covered in the retrieved sources for this research run." and unsupportedOrMissing to true.
- Never invent facts, dates, authors, or sources.
- Cite sources as [S1], [S2] matching only the IDs in DATA.
Return {"answer": string, "citedSourceLabels": string[], "unsupportedOrMissing": boolean}.`,
    task: `Question: ${question}`,
    data: {
      researchTopic: run.question,
      reportSummary: report?.summary,
      claims: claims.map((c) => ({ text: c.text, status: c.status, reasoning: c.reasoning })),
      sources: sources.map((s) => ({
        label: s.label,
        title: s.title,
        domain: s.domain,
        publishedAt: s.publishedAt ?? "Unknown",
        excerpt: s.excerpt,
      })),
    },
  });

  res.json(reply);
});

researchRouter.delete("/:id", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  await Promise.all([
    Source.deleteMany({ runId: run._id }),
    SourceSnapshot.deleteMany({ runId: run._id }),
    Claim.deleteMany({ runId: run._id }),
    Report.deleteMany({ runId: run._id }),
    AgentEvent.deleteMany({ runId: run._id }),
  ]);
  await run.deleteOne();
  res.json({ ok: true });
});
