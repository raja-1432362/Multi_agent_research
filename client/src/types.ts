export type RunStatus = "queued" | "planning" | "searching" | "analysing" | "verifying" | "writing" | "completed" | "failed" | "cancelled";
export const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];
export const STAGES: RunStatus[] = ["queued", "planning", "searching", "analysing", "verifying", "writing", "completed"];

export interface User { id: string; email: string; displayName: string; token?: string }
export interface Run {
  _id: string;
  question: string;
  status: RunStatus;
  currentStage: string;
  scope: { depth: string; maxSources: number; dateFrom?: string; dateTo?: string };
  searchQueries: string[];
  sourceCount: number;
  warnings: string[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}
export interface RunEvent { _id: string; stage: string; message: string; level: "info" | "warn" | "error"; timestamp: string }
export interface Source { _id: string; label: string; title: string; url: string; domain: string; publishedAt?: string; retrievedAt: string; excerpt: string; contentType: string }
export type ClaimStatus = "supported" | "contradicted" | "mixed" | "insufficient";
export interface Claim {
  _id: string; claimId: string; text: string; theme?: string; status: ClaimStatus;
  evidence: { sourceLabel: string; sourceId: string; supportType: "supports" | "contradicts" | "neutral"; excerpt: string }[];
  reasoning?: string; limitations: string[];
}
export interface Report {
  title: string; summary: string;
  sections: { heading: string; body: string; claimIds: string[] }[];
  themes: { name: string; summary: string }[];
  disagreements: string[]; limitations: string[]; referenceSourceIds: string[];
}
