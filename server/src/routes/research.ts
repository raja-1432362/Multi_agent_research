import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { AgentEvent, Claim, Report, ResearchRun, Source, TERMINAL } from "../models";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { createRunSchema } from "../validators/schemas";
import { env } from "../config/env";
import { resetRun, runResearch } from "../workflows/research.graph";
import { streamReportPdf } from "../services/reports/pdf";

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
  const since = new Date(Date.now() - 864e5);
  const used = await ResearchRun.countDocuments({ userId: req.userId, createdAt: { $gte: since } });
  if (used >= env.MAX_RUNS_PER_DAY) {
    throw new HttpError(429, `Daily limit of ${env.MAX_RUNS_PER_DAY} research runs reached. This protects the free API quotas.`);
  }
  const run = await ResearchRun.create({
    userId: req.userId,
    question: body.question,
    scope: { depth: body.depth, maxSources: body.maxSources, dateFrom: body.dateFrom, dateTo: body.dateTo },
  });
  void runResearch(String(run._id)); // background; progress is polled by the client
  res.status(202).json(run);
});

researchRouter.get("/", async (req, res) => {
  const runs = await ResearchRun.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
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

researchRouter.get("/:id/report", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  const report = await Report.findOne({ runId: run._id });
  if (!report) throw new HttpError(404, "Report is not ready yet");
  res.json(report);
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
      limitations: report.limitations,
      disagreements: report.disagreements,
    },
    sources: sources.map((s) => ({ label: s.label, title: s.title, url: s.url, retrievedAt: s.retrievedAt })),
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
      sources: sources.map((s) => ({ label: s.label, title: s.title, domain: s.domain, excerpt: s.excerpt })),
    },
  });

  res.json(reply);
});

researchRouter.delete("/:id", async (req, res) => {
  const run = await ownedRun(req.userId, req.params.id);
  await Promise.all([
    Source.deleteMany({ runId: run._id }),
    Claim.deleteMany({ runId: run._id }),
    Report.deleteMany({ runId: run._id }),
    AgentEvent.deleteMany({ runId: run._id }),
  ]);
  await run.deleteOne();
  res.json({ ok: true });
});
