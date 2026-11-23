import { Schema, model, InferSchemaType } from "mongoose";

export const RUN_STATUSES = [
  "queued", "planning", "searching", "analysing", "verifying", "writing", "completed", "failed", "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const runSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    completedAt: Date,
  },
  { timestamps: true }
);
runSchema.index({ userId: 1, createdAt: -1 });

const sourceSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  label: { type: String, required: true }, // S1, S2... used in citations
  title: String,
  url: { type: String, required: true },
  canonicalUrl: { type: String, required: true },
  domain: String,
  publishedAt: String,
  retrievedAt: { type: Date, default: Date.now },
  excerpt: String,
  contentType: { type: String, default: "search_excerpt" }, // search_excerpt | extracted_page
  searchQuery: String,
});
sourceSchema.index({ runId: 1, canonicalUrl: 1 });

const claimSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, index: true },
  claimId: { type: String, required: true }, // clm_001
  text: { type: String, required: true },
  theme: String,
  status: { type: String, enum: ["supported", "contradicted", "mixed", "insufficient"], required: true },
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
});

const reportSchema = new Schema({
  runId: { type: Schema.Types.ObjectId, ref: "ResearchRun", required: true, unique: true },
  title: String,
  summary: String,
  sections: [{ _id: false, heading: String, body: String, claimIds: [String] }],
  themes: [{ _id: false, name: String, summary: String }],
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
export const ResearchRun = model("ResearchRun", runSchema);
export const Source = model("Source", sourceSchema);
export const Claim = model("Claim", claimSchema);
export const Report = model("Report", reportSchema);
export const AgentEvent = model("AgentEvent", eventSchema);

export type SourceDoc = InferSchemaType<typeof sourceSchema> & { _id: unknown };
