import { Schema, model, InferSchemaType } from "mongoose";

export const RUN_STATUSES = [
  "queued", "planning", "searching", "analysing", "verifying", "writing", "completed", "failed", "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];

export const SOURCE_TYPES = [
  "official_page",
  "documentation",
  "release_notes",
  "company_blog",
  "rss_feed",
  "user_upload",
  "academic",
  "news",
  "search_excerpt",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const FETCH_STATUSES = ["ok", "failed", "blocked", "robots_disallowed"] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

export const CHANGE_STATUSES = ["new", "changed", "unchanged", "failed", "stale_fallback"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const workspaceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    competitors: [
      {
        name: { type: String, required: true, trim: true },
        domain: { type: String, default: "", trim: true },
        notes: { type: String, default: "", trim: true },
      },
    ],
    approvedSources: [
      {
        label: { type: String, required: true, trim: true },
        publisher: { type: String, default: "", trim: true },
        url: { type: String, required: true },
        canonicalUrl: { type: String, required: true },
        domain: { type: String, default: "" },
        sourceType: { type: String, enum: SOURCE_TYPES, default: "official_page" },
        isOfficial: { type: Boolean, default: true },
        uploadedText: String,
        enabled: { type: Boolean, default: true },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    schedule: {
      cadence: { type: String, enum: ["manual", "daily", "weekly"], default: "manual" },
      defaultQuestion: { type: String, default: "What changed in competitor products, pricing, release notes, or documentation?" },
      lastRunAt: Date,
      nextRunAt: Date,
    },
    limits: {
      maxRequestsPerRun: { type: Number, default: 12 },
    },
  },
  { timestamps: true }
);
workspaceSchema.index({ userId: 1, createdAt: -1 });

const sourceSnapshotSchema = new Schema({
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  canonicalUrl: { type: String, required: true },
  url: { type: String, required: true },
  domain: String,
  publisher: String,
  title: String,
  sourceType: { type: String, enum: SOURCE_TYPES, default: "official_page" },
  publishedAt: { type: String, default: null }, // null when unknown; never guessed
  retrievedAt: { type: Date, default: Date.now },
  contentHash: String,
  normalizedText: String,
  fetchStatus: { type: String, enum: FETCH_STATUSES, default: "ok" },
  fetchError: String,
  changeStatus: { type: String, enum: CHANGE_STATUSES, default: "new" },
  diffSummary: String,
  addedLines: { type: [String], default: [] },
  removedLines: { type: [String], default: [] },
});
sourceSnapshotSchema.index({ workspaceId: 1, canonicalUrl: 1, retrievedAt: -1 });

const runSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", index: true },
    triggerType: { type: String, enum: ["manual", "scheduled"], default: "manual" },
    collectionMode: { type: String, enum: ["open_web", "workspace_watchlist", "hybrid"], default: "open_web" },
    question: { type: String, required: true },
    scope: {
      depth: { type: String, enum: ["quick", "standard", "deep"], default: "standard" },
      maxSources: { type: Number, default: 10 },
      dateFrom: String,
      dateTo: String,
    },
    status: { type: String, enum: RUN_STATUSES, default: "queued" },
    currentStage: { type: String, default: "queued" },
    searchQueries: { type: [String], default: [] },
    sourceCount: { type: Number, default: 0 },
    error: String,
    warnings: { type: [String], default: [] },
    metrics: {
      durationMs: Number,
      sourcesAttempted: { type: Number, default: 0 },
      sourcesFailed: { type: Number, default: 0 },
      snapshotsChanged: { type: Number, default: 0 },
      quoteMatchRate: { type: Number, default: 1 },
      humanCorrectionsCount: { type: Number, default: 0 },
    },
    completedAt: Date,
  },
  { timestamps: true }
);
runSchema.index({ userId: 1, createdAt: -1 });
runSchema.index({ workspaceId: 1, createdAt: -1 });

const sourceSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
  snapshotId: { type: Schema.Types.ObjectId, ref: "SourceSnapshot" },
  label: { type: String, required: true }, // S1, S2... used in citations
  title: String,
  publisher: String,
  url: { type: String, required: true },
  canonicalUrl: { type: String, required: true },
  domain: String,
  publishedAt: { type: String, default: null }, // strictly null/unknown if source did not provide one
  retrievedAt: { type: Date, default: Date.now },
  excerpt: String,
  contentType: { type: String, default: "search_excerpt" },
  sourceType: { type: String, enum: SOURCE_TYPES, default: "search_excerpt" },
  isOfficial: { type: Boolean, default: false },
  contentHash: String,
  fetchStatus: { type: String, enum: FETCH_STATUSES, default: "ok" },
  fetchError: String,
  changeStatus: { type: String, enum: CHANGE_STATUSES, default: "new" },
  diffSummary: String,
  searchQuery: String,
});
sourceSchema.index({ runId: 1, canonicalUrl: 1 });

const claimSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  claimId: { type: String, required: true }, // clm_001
  text: { type: String, required: true },
  theme: String,
  status: { type: String, enum: ["supported", "contradicted", "mixed", "insufficient"], required: true },
  codeVerified: { type: Boolean, default: false },
  evidence: [
    {
      _id: false,
      sourceLabel: String,
      sourceId: Schema.Types.ObjectId,
      supportType: { type: String, enum: ["supports", "contradicts", "neutral"] },
      excerpt: String,
    },
  ],
  reasoning: String,
  limitations: { type: [String], default: [] },
  humanReview: {
    status: { type: String, enum: ["unreviewed", "approved", "corrected", "flagged"], default: "unreviewed" },
    note: String,
    correctedText: String,
    reviewedAt: Date,
  },
});

const reportSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, unique: true },
  title: String,
  summary: String,
  sections: [{ _id: false, heading: String, body: String, claimIds: [String] }],
  themes: [{ _id: false, name: String, summary: String }],
  changesSummary: { type: [String], default: [] },
  collectionWarnings: { type: [String], default: [] },
  disagreements: [String],
  limitations: [String],
  referenceSourceIds: [String], // labels
});

const eventSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  stage: String,
  message: String,
  level: { type: String, enum: ["info", "warn", "error"], default: "info" },
  timestamp: { type: Date, default: Date.now },
});

export const User = model("User", userSchema);
export const Workspace = model("Workspace", workspaceSchema);
export const SourceSnapshot = model("SourceSnapshot", sourceSnapshotSchema);
export const ResearchRun = model("ResearchRun", runSchema);
export const Source = model("Source", sourceSchema);
export const Claim = model("Claim", claimSchema);
export const Report = model("Report", reportSchema);
export const AgentEvent = model("AgentEvent", eventSchema);

export type SourceDoc = InferSchemaType<typeof sourceSchema> & { _id: unknown };
export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & { _id: unknown };
