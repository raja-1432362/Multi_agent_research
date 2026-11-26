export type RunStatus = "queued" | "planning" | "searching" | "analysing" | "verifying" | "writing" | "completed" | "failed" | "cancelled";
export const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];
export const STAGES: RunStatus[] = ["queued", "planning", "searching", "analysing", "verifying", "writing", "completed"];

export type SourceType =
  | "official_page"
  | "documentation"
  | "release_notes"
  | "company_blog"
  | "rss_feed"
  | "user_upload"
  | "academic"
  | "news"
  | "search_excerpt";

export type FetchStatus = "ok" | "failed" | "blocked" | "robots_disallowed";
export type ChangeStatus = "new" | "changed" | "unchanged" | "failed" | "stale_fallback";

export interface User { id: string; email: string; displayName: string; token?: string }

export interface Competitor {
  _id: string;
  name: string;
  domain: string;
  notes: string;
}

export interface ApprovedSource {
  _id: string;
  label: string;
  publisher: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  sourceType: SourceType;
  isOfficial: boolean;
  uploadedText?: string;
  enabled: boolean;
  addedAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
  description: string;
  competitors: Competitor[];
  approvedSources: ApprovedSource[];
  schedule: {
    cadence: "manual" | "daily" | "weekly";
    defaultQuestion?: string;
    lastRunAt?: string;
    nextRunAt?: string;
  };
  limits?: { maxRequestsPerRun: number };
  createdAt: string;
  updatedAt: string;
}

export interface SourceSnapshot {
  _id: string;
  workspaceId: string;
  runId: string;
  canonicalUrl: string;
  url: string;
  domain?: string;
  publisher?: string;
  title?: string;
  sourceType: SourceType;
  publishedAt?: string | null;
  retrievedAt: string;
  contentHash?: string;
  fetchStatus: FetchStatus;
  fetchError?: string;
  changeStatus: ChangeStatus;
  diffSummary?: string;
  addedLines: string[];
  removedLines: string[];
}

export interface Run {
  _id: string;
  workspaceId?: string;
  triggerType?: "manual" | "scheduled";
  collectionMode?: "open_web" | "workspace_watchlist" | "hybrid";
  question: string;
  status: RunStatus;
  currentStage: string;
  scope: { depth: string; maxSources: number; dateFrom?: string; dateTo?: string };
  searchQueries: string[];
  sourceCount: number;
  warnings: string[];
  error?: string;
  metrics?: {
    durationMs?: number;
    sourcesAttempted?: number;
    sourcesFailed?: number;
    snapshotsChanged?: number;
    quoteMatchRate?: number;
    humanCorrectionsCount?: number;
  };
  createdAt: string;
  completedAt?: string;
}

export interface RunEvent { _id: string; stage: string; message: string; level: "info" | "warn" | "error"; timestamp: string }

export interface Source {
  _id: string;
  label: string;
  title: string;
  publisher?: string;
  url: string;
  domain: string;
  publishedAt?: string | null;
  retrievedAt: string;
  excerpt: string;
  contentType: string;
  sourceType?: SourceType;
  isOfficial?: boolean;
  contentHash?: string;
  fetchStatus?: FetchStatus;
  fetchError?: string;
  changeStatus?: ChangeStatus;
  diffSummary?: string;
}

export type ClaimStatus = "supported" | "contradicted" | "mixed" | "insufficient";

export interface Claim {
  _id: string;
  claimId: string;
  text: string;
  theme?: string;
  status: ClaimStatus;
  codeVerified?: boolean;
  evidence: { sourceLabel: string; sourceId: string; supportType: "supports" | "contradicts" | "neutral"; excerpt: string }[];
  reasoning?: string;
  limitations: string[];
  humanReview?: {
    status: "unreviewed" | "approved" | "corrected" | "flagged";
    note?: string;
    correctedText?: string;
    reviewedAt?: string;
  };
}

export interface Report {
  title: string;
  summary: string;
  sections: { heading: string; body: string; claimIds: string[] }[];
  themes: { name: string; summary: string }[];
  changesSummary?: string[];
  collectionWarnings?: string[];
  disagreements: string[];
  limitations: string[];
  referenceSourceIds: string[];
}
