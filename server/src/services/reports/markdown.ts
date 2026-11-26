interface MarkdownReportInput {
  question: string;
  createdAt?: Date | string;
  report: {
    title?: string | null;
    summary?: string | null;
    sections: { heading?: string | null; body?: string | null; claimIds?: string[] }[];
    changesSummary?: string[];
    collectionWarnings?: string[];
    disagreements?: string[];
    limitations?: string[];
  };
  claims: Array<{
    claimId: string;
    text: string;
    status: string;
    codeVerified?: boolean;
    reasoning?: string | null;
    humanReview?: { status?: string; note?: string | null; correctedText?: string | null } | null;
    evidence: Array<{ sourceLabel?: string | null; supportType?: string | null; excerpt?: string | null }>;
  }>;
  sources: Array<{
    label: string;
    title?: string | null;
    publisher?: string | null;
    url: string;
    sourceType?: string | null;
    isOfficial?: boolean;
    publishedAt?: string | null;
    retrievedAt?: Date | string | null;
    changeStatus?: string | null;
  }>;
}

function statusDisplay(status: string): string {
  if (status === "supported") return "Supported";
  if (status === "contradicted" || status === "mixed") return "Contradicted / Disputed";
  return "Not enough evidence";
}

export function buildReportMarkdown(input: MarkdownReportInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.report.title ?? "Research Report"}`);
  lines.push("");
  lines.push(`**Question:** ${input.question}`);
  if (input.createdAt) {
    lines.push(`**Generated:** ${new Date(input.createdAt).toISOString()}`);
  }
  lines.push("");
  lines.push("## Executive Summary");
  lines.push(input.report.summary ?? "");
  lines.push("");

  if (input.report.collectionWarnings && input.report.collectionWarnings.length > 0) {
    lines.push("## Collection Failures & Freshness Warnings");
    for (const w of input.report.collectionWarnings) lines.push(`- ⚠ ${w}`);
    lines.push("");
  }

  if (input.report.changesSummary && input.report.changesSummary.length > 0) {
    lines.push("## What Changed Since Earlier Snapshots");
    for (const ch of input.report.changesSummary) lines.push(`- ${ch}`);
    lines.push("");
  }

  for (const s of input.report.sections) {
    lines.push(`## ${s.heading ?? "Findings"}`);
    lines.push(s.body ?? "");
    lines.push("");
  }

  if (input.report.disagreements && input.report.disagreements.length > 0) {
    lines.push("## Disagreements Between Sources");
    for (const d of input.report.disagreements) lines.push(`- ${d}`);
    lines.push("");
  }

  if (input.claims.length > 0) {
    lines.push("## Inspectable Claims & Human Review");
    for (const c of input.claims) {
      const reviewTag = c.humanReview?.status && c.humanReview.status !== "unreviewed"
        ? ` | Human Review: ${c.humanReview.status.toUpperCase()}`
        : "";
      lines.push(`### [${c.claimId}] ${statusDisplay(c.status)}${reviewTag}`);
      if (c.humanReview?.status === "corrected" && c.humanReview.correctedText) {
        lines.push(`- **Corrected Finding (Human):** ${c.humanReview.correctedText}`);
        lines.push(`- **Original AI Claim:** ${c.text}`);
      } else {
        lines.push(`- **Claim:** ${c.text}`);
      }
      if (c.humanReview?.note) lines.push(`- **Reviewer Note:** ${c.humanReview.note}`);
      lines.push(`- **Code Quote Check:** ${c.codeVerified ? "Passed (verbatim match in saved snapshot)" : "No verbatim match"}`);
      if (c.reasoning) lines.push(`- **Meaning Check:** ${c.reasoning}`);
      for (const ev of c.evidence) {
        lines.push(`  - [${ev.sourceLabel}] (${ev.supportType}): "${ev.excerpt}"`);
      }
      lines.push("");
    }
  }

  lines.push("## Limitations");
  for (const l of input.report.limitations ?? []) lines.push(`- ${l}`);
  lines.push("");

  lines.push("## Collected Sources");
  for (const s of input.sources) {
    const pubDate = s.publishedAt ? `Published: ${s.publishedAt}` : "Published: Unknown";
    const retDate = s.retrievedAt ? `Retrieved: ${new Date(s.retrievedAt).toISOString().slice(0, 10)}` : "";
    const officialTag = s.isOfficial ? "Official" : s.sourceType ?? "External";
    lines.push(`- **[${s.label}] ${s.title ?? s.url}** (${officialTag}) — ${pubDate}${retDate ? ` | ${retDate}` : ""}`);
    lines.push(`  - URL: ${s.url}`);
  }

  return lines.join("\n");
}
