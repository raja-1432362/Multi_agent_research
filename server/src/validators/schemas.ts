import { z } from "zod";
import { SOURCE_TYPES } from "../models";

export const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
  displayName: z.string().trim().min(1).max(60),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1).max(100) });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("").transform(() => undefined));

export const createRunSchema = z.object({
  question: z.string().trim().min(10, "Ask a more specific question (10+ characters)").max(500),
  depth: z.enum(["quick", "standard", "deep"]).default("standard"),
  maxSources: z.coerce.number().int().min(3).max(30).default(10),
  dateFrom: date,
  dateTo: date,
  workspaceId: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  collectionMode: z.enum(["open_web", "workspace_watchlist", "hybrid"]).optional(),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "Workspace name must be at least 2 characters").max(80),
  description: z.string().trim().max(300).default(""),
});

export const addCompetitorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  domain: z.string().trim().max(120).default(""),
  notes: z.string().trim().max(300).default(""),
});

export const addApprovedSourceSchema = z.object({
  label: z.string().trim().min(1).max(80),
  publisher: z.string().trim().max(80).default(""),
  url: z.string().trim().min(1).max(500),
  sourceType: z.enum(SOURCE_TYPES).default("official_page"),
  isOfficial: z.boolean().default(true),
  uploadedText: z.string().max(15000).optional(),
});

export const updateScheduleSchema = z.object({
  cadence: z.enum(["manual", "daily", "weekly"]),
  defaultQuestion: z.string().trim().min(10).max(500).optional(),
});

export const claimReviewSchema = z.object({
  status: z.enum(["approved", "corrected", "flagged", "unreviewed"]),
  note: z.string().trim().max(500).optional(),
  correctedText: z.string().trim().max(600).optional(),
});
