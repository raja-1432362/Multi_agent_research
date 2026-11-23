import { Annotation } from "@langchain/langgraph";

export interface Scope {
  depth: "quick" | "standard" | "deep";
  maxSources: number;
  dateFrom?: string;
  dateTo?: string;
}
export interface SourceItem {
  id: string; // Mongo _id as string
  label: string; // S1, S2 ...
  title: string;
  url: string;
  domain: string;
  publishedAt?: string;
  excerpt: string;
}
export type ClaimStatus = "supported" | "contradicted" | "mixed" | "insufficient";
export interface EvidenceItem {
  sourceLabel: string;
  sourceId: string;
  supportType: "supports" | "contradicts" | "neutral";
  excerpt: string;
}
export interface ClaimItem {
  claimId: string;
  text: string;
  theme?: string;
  sourceLabels: string[];
  status?: ClaimStatus;
  evidence: EvidenceItem[];
  reasoning?: string;
  limitations: string[];
}
export interface ReportItem {
  title: string;
  summary: string;
  sections: { heading: string; body: string; claimIds: string[] }[];
  limitations: string[];
}

export const ResearchState = Annotation.Root({
  runId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  scope: Annotation<Scope>(),
  searchQueries: Annotation<string[]>(),
  sources: Annotation<SourceItem[]>(),
  themes: Annotation<{ name: string; summary: string }[]>(),
  disagreements: Annotation<string[]>(),
  claims: Annotation<ClaimItem[]>(),
  report: Annotation<ReportItem | null>(),
  insufficient: Annotation<boolean>(),
  errors: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  currentStage: Annotation<string>(),
});
export type State = typeof ResearchState.State;
