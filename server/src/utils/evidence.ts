import { createHash } from "crypto";

// Pure helpers (no env/db) so they are easy to unit test.

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_src)/i;

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Rejects localhost, private networks, link-local, metadata endpoints, and non-HTTP schemes (SSRF defense). */
export function isSafePublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
      return false;
    }
    if (host === "::1" || host === "::" || /^fe80:/i.test(host) || /^f[cd][0-9a-f]{2}:/i.test(host)) {
      return false;
    }
    // Block pure integer/hex IP encodings
    if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return false;

    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
      if (a === 0 || a === 10 || a === 127) return false;
      if (a === 169 && b === 254) return false; // cloud metadata
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a >= 224) return false;
    }
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export function isUrlApproved(rawUrl: string, approvedUrls: string[], approvedDomains: string[]): boolean {
  const c = canonicalUrl(rawUrl);
  if (!c) return false;
  const normalizedApproved = new Set(approvedUrls.map((u) => canonicalUrl(u)).filter((x): x is string => Boolean(x)));
  if (normalizedApproved.has(c)) return true;

  const host = domainOf(c);
  return approvedDomains.some((d) => {
    const clean = d.trim().toLowerCase().replace(/^www\./, "");
    return clean.length > 0 && (host === clean || host.endsWith(`.${clean}`));
  });
}

export function normText(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** True only if `excerpt` really appears in the stored source text. */
export function excerptInSource(excerpt: string, sourceText: string): boolean {
  const e = normText(excerpt);
  if (e.length < 8) return false;
  return normText(sourceText).includes(e);
}

/** Removes [S#] citations that do not match a real source label. */
export function stripInvalidCitations(text: string, validLabels: Set<string>): string {
  return text.replace(/\[(S\d+)\]/g, (m, label: string) => (validLabels.has(label) ? m : ""));
}

export function citedLabels(text: string): string[] {
  return [...new Set([...text.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]))];
}

export function computeContentHash(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function splitMeaningfulUnits(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 12);
}

export interface SnapshotDiffResult {
  changeStatus: "new" | "changed" | "unchanged";
  diffSummary: string;
  addedLines: string[];
  removedLines: string[];
}

export function diffSnapshots(oldText: string | null | undefined, newText: string): SnapshotDiffResult {
  const cleanNew = newText.replace(/\s+/g, " ").trim();
  if (!oldText || !oldText.trim()) {
    return {
      changeStatus: "new",
      diffSummary: "Initial baseline snapshot captured.",
      addedLines: splitMeaningfulUnits(newText).slice(0, 8),
      removedLines: [],
    };
  }
  const oldHash = computeContentHash(oldText);
  const newHash = computeContentHash(cleanNew);
  if (oldHash === newHash) {
    return {
      changeStatus: "unchanged",
      diffSummary: "No content changes detected compared to earlier snapshot.",
      addedLines: [],
      removedLines: [],
    };
  }

  const oldUnits = splitMeaningfulUnits(oldText);
  const newUnits = splitMeaningfulUnits(newText);
  const oldSet = new Set(oldUnits.map(normText));
  const newSet = new Set(newUnits.map(normText));

  const addedLines = newUnits.filter((u) => !oldSet.has(normText(u))).slice(0, 12);
  const removedLines = oldUnits.filter((u) => !newSet.has(normText(u))).slice(0, 12);

  if (addedLines.length === 0 && removedLines.length === 0) {
    return {
      changeStatus: "unchanged",
      diffSummary: "Only minor formatting differences; factual content appears unchanged.",
      addedLines: [],
      removedLines: [],
    };
  }

  return {
    changeStatus: "changed",
    diffSummary: `Detected ${addedLines.length} new/updated statement(s) and ${removedLines.length} removed statement(s).`,
    addedLines,
    removedLines,
  };
}

const INJECTION_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "instruction_override", regex: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { name: "system_prompt_probe", regex: /(reveal|print|output|show)\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key)/i },
  { name: "role_hijack", regex: /you\s+are\s+now\s+(a|an|in)\s+(admin|developer|unrestricted|root)/i },
  { name: "tool_trigger_attempt", regex: /(execute|invoke|run|call)\s+(the\s+)?(tool|shell|bash|function|http_fetch|delete_workspace)/i },
];

/** Neutralizes invisible control chars and detects prompt-injection attempts inside untrusted web text. */
export function sanitizeUntrustedText(raw: string): { text: string; injectionDetected: boolean; signals: string[] } {
  // Strip control characters except newline/tab and strip zero-width unicode obfuscation
  const stripped = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  const signals: string[] = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.regex.test(stripped)) signals.push(p.name);
  }
  return {
    text: stripped,
    injectionDetected: signals.length > 0,
    signals,
  };
}

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/** Parses RFC 9309 robots.txt rules for a given crawler token (falls back to '*'). */
export function parseRobotsTxt(body: string, agentName = "evidencedesk"): RobotsRules {
  const lines = body.split(/\r?\n/);
  const specific: RobotsRules = { allow: [], disallow: [] };
  const wildcard: RobotsRules = { allow: [], disallow: [] };
  let activeGroups: Array<"specific" | "wildcard"> = [];
  let seenRuleInBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      activeGroups = [];
      seenRuleInBlock = false;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (seenRuleInBlock) {
        activeGroups = [];
        seenRuleInBlock = false;
      }
      const ua = val.toLowerCase();
      if (ua === agentName.toLowerCase()) activeGroups.push("specific");
      else if (ua === "*") activeGroups.push("wildcard");
    } else if (key === "disallow" || key === "allow") {
      seenRuleInBlock = true;
      if (!val) continue;
      for (const grp of activeGroups) {
        const target = grp === "specific" ? specific : wildcard;
        if (key === "disallow") target.disallow.push(val);
        else target.allow.push(val);
      }
    }
  }

  return specific.allow.length || specific.disallow.length ? specific : wildcard;
}

/** Longest-match RFC 9309 evaluation. */
export function isPathAllowedByRobots(pathname: string, rules: RobotsRules): boolean {
  let bestAllow = -1;
  let bestDisallow = -1;

  const matches = (pattern: string, path: string): boolean => {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const anchored = escaped.endsWith("$") ? `^${escaped}` : `^${escaped}`;
    try {
      return new RegExp(anchored).test(path);
    } catch {
      return path.startsWith(pattern);
    }
  };

  for (const p of rules.allow) {
    if (matches(p, pathname)) bestAllow = Math.max(bestAllow, p.length);
  }
  for (const p of rules.disallow) {
    if (matches(p, pathname)) bestDisallow = Math.max(bestDisallow, p.length);
  }

  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}
