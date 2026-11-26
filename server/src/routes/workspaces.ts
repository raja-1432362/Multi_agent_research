import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";
import { AgentEvent, Claim, Report, ResearchRun, Source, SourceSnapshot, Workspace } from "../models";
import { canonicalUrl, domainOf, isSafePublicUrl } from "../utils/evidence";
import {
  addApprovedSourceSchema,
  addCompetitorSchema,
  createWorkspaceSchema,
  updateScheduleSchema,
} from "../validators/schemas";
import { runResearch } from "../workflows/research.graph";

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

async function ownedWorkspace(userId: string | undefined, id: string) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Workspace not found");
  const ws = await Workspace.findOne({ _id: id, userId });
  if (!ws) throw new HttpError(404, "Workspace not found");
  return ws;
}

workspaceRouter.get("/", async (req, res) => {
  const workspaces = await Workspace.find({ userId: req.userId }).sort({ updatedAt: -1 }).limit(50);
  res.json(workspaces);
});

workspaceRouter.post("/", async (req, res) => {
  const body = createWorkspaceSchema.parse(req.body);
  const ws = await Workspace.create({
    userId: req.userId,
    name: body.name,
    description: body.description,
  });
  res.status(201).json(ws);
});

workspaceRouter.get("/:id", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const [runs, snapshots] = await Promise.all([
    ResearchRun.find({ workspaceId: ws._id, userId: req.userId }).sort({ createdAt: -1 }).limit(25),
    SourceSnapshot.find({ workspaceId: ws._id, userId: req.userId }).sort({ retrievedAt: -1 }).limit(40),
  ]);
  res.json({ workspace: ws, runs, snapshots });
});

workspaceRouter.delete("/:id", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const runs = await ResearchRun.find({ workspaceId: ws._id, userId: req.userId }).select("_id");
  const runIds = runs.map((r) => r._id);
  await Promise.all([
    SourceSnapshot.deleteMany({ workspaceId: ws._id, userId: req.userId }),
    Source.deleteMany({ runId: { $in: runIds } }),
    Claim.deleteMany({ runId: { $in: runIds } }),
    Report.deleteMany({ runId: { $in: runIds } }),
    AgentEvent.deleteMany({ runId: { $in: runIds } }),
    ResearchRun.deleteMany({ _id: { $in: runIds } }),
  ]);
  await ws.deleteOne();
  res.json({ ok: true });
});

workspaceRouter.post("/:id/competitors", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const body = addCompetitorSchema.parse(req.body);
  if (ws.competitors.length >= 20) throw new HttpError(400, "Maximum of 20 competitors per workspace reached");
  const cleanDomain = body.domain ? body.domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() : "";
  ws.competitors.push({ name: body.name, domain: cleanDomain, notes: body.notes });
  await ws.save();
  res.status(201).json(ws);
});

workspaceRouter.delete("/:id/competitors/:compId", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  ws.competitors.pull({ _id: req.params.compId });
  await ws.save();
  res.json(ws);
});

workspaceRouter.post("/:id/sources", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const body = addApprovedSourceSchema.parse(req.body);
  if (ws.approvedSources.length >= 25) throw new HttpError(400, "Maximum of 25 approved sources per workspace reached");

  let canon: string;
  let dom: string;
  if (body.sourceType === "user_upload") {
    if (!body.uploadedText || body.uploadedText.trim().length < 15) {
      throw new HttpError(400, "Uploaded document must contain at least 15 characters of text");
    }
    const slug = body.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "doc";
    canon = `upload://${slug}-${Date.now()}`;
    dom = "uploaded-document";
  } else {
    if (!isSafePublicUrl(body.url)) {
      throw new HttpError(400, "Please provide a valid public http:// or https:// URL (local/private network URLs are not allowed)");
    }
    const c = canonicalUrl(body.url);
    if (!c) throw new HttpError(400, "Invalid URL format");
    canon = c;
    dom = domainOf(c);
    if (ws.approvedSources.some((s) => s.canonicalUrl === canon)) {
      throw new HttpError(409, "This approved source URL is already in the watchlist");
    }
  }

  ws.approvedSources.push({
    label: body.label,
    publisher: body.publisher || dom,
    url: body.sourceType === "user_upload" ? canon : body.url,
    canonicalUrl: canon,
    domain: dom,
    sourceType: body.sourceType,
    isOfficial: body.isOfficial,
    uploadedText: body.sourceType === "user_upload" ? body.uploadedText?.trim() : undefined,
    enabled: true,
  });
  await ws.save();
  res.status(201).json(ws);
});

workspaceRouter.delete("/:id/sources/:srcId", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  ws.approvedSources.pull({ _id: req.params.srcId });
  await ws.save();
  res.json(ws);
});

workspaceRouter.patch("/:id/schedule", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const body = updateScheduleSchema.parse(req.body);
  const now = new Date();
  let nextRunAt: Date | undefined;
  if (body.cadence === "daily") nextRunAt = new Date(now.getTime() + 864e5);
  else if (body.cadence === "weekly") nextRunAt = new Date(now.getTime() + 7 * 864e5);

  ws.schedule = {
    cadence: body.cadence,
    defaultQuestion: body.defaultQuestion ?? ws.schedule?.defaultQuestion ?? "What changed in competitor products, pricing, release notes, or documentation?",
    lastRunAt: ws.schedule?.lastRunAt,
    nextRunAt,
  };
  await ws.save();
  res.json(ws);
});

workspaceRouter.get("/:id/changes", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const snapshots = await SourceSnapshot.find({ workspaceId: ws._id, userId: req.userId })
    .sort({ retrievedAt: -1 })
    .limit(50);
  res.json(snapshots);
});

const runWorkspaceSchema = z.object({
  question: z.string().trim().min(10).max(500).optional(),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
  collectionMode: z.enum(["workspace_watchlist", "hybrid"]).default("workspace_watchlist"),
});

workspaceRouter.post("/:id/run", async (req, res) => {
  const ws = await ownedWorkspace(req.userId, req.params.id);
  const body = runWorkspaceSchema.parse(req.body ?? {});

  const enabledCount = ws.approvedSources.filter((s) => s.enabled).length;
  const domainCount = ws.competitors.filter((c) => c.domain).length;
  if (enabledCount === 0 && domainCount === 0) {
    throw new HttpError(400, "Add at least one approved source URL, uploaded document, or competitor domain before running a check.");
  }

  const since = new Date(Date.now() - 864e5);
  const used = await ResearchRun.countDocuments({ userId: req.userId, createdAt: { $gte: since } });
  if (used >= env.MAX_RUNS_PER_DAY) {
    throw new HttpError(429, `Daily limit of ${env.MAX_RUNS_PER_DAY} research runs reached. This protects free API quotas.`);
  }

  const question = body.question || ws.schedule?.defaultQuestion || `What changed recently across ${ws.name}?`;
  const run = await ResearchRun.create({
    userId: req.userId,
    workspaceId: ws._id,
    triggerType: "manual",
    collectionMode: body.collectionMode,
    question,
    scope: { depth: body.depth, maxSources: Math.min(ws.limits?.maxRequestsPerRun ?? 12, env.MAX_SOURCES_CAP) },
  });

  void runResearch(String(run._id));
  res.status(202).json(run);
});
