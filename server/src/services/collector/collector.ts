import { FetchStatus, SourceType } from "../../models";
import {
  canonicalUrl,
  computeContentHash,
  domainOf,
  isPathAllowedByRobots,
  isSafePublicUrl,
  parseRobotsTxt,
  RobotsRules,
  sanitizeUntrustedText,
} from "../../utils/evidence";

export interface ApprovedSourceInput {
  label: string;
  publisher?: string;
  url: string;
  sourceType: SourceType;
  isOfficial?: boolean;
  uploadedText?: string;
}

export interface CollectedSourceResult {
  label: string;
  title: string;
  publisher: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  publishedAt: string | null; // Strictly null when page/feed provides no explicit date
  retrievedAt: Date;
  sourceType: SourceType;
  isOfficial: boolean;
  contentHash: string;
  normalizedText: string;
  fetchStatus: FetchStatus;
  fetchError?: string;
  injectionSignals: string[];
}

const USER_AGENT = "EvidenceDesk-ResearchCollector/1.0 (Respectful public source monitor)";
const MAX_BODY_BYTES = 512 * 1024;
const ROBOTS_CACHE = new Map<string, { rules: RobotsRules; expiresAt: number }>();

export function clearRobotsCache() {
  ROBOTS_CACHE.clear();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripHtmlTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

function extractPublishedDateFromHtml(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:article:published_time|article:modified_time|og:updated_time|publishdate|pubdate|date)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|article:modified_time|og:updated_time|publishdate|pubdate|date)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /"dateModified"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(candidate)) return candidate.slice(0, 10);
      const parsed = Date.parse(candidate);
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  return null;
}

function extractTitleFromHtml(html: string, fallback: string): string {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (og?.[1]) return decodeHtmlEntities(og[1].trim());
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) return decodeHtmlEntities(title[1].replace(/\s+/g, " ").trim());
  return fallback;
}

function extractPublisherFromHtml(html: string, domain: string, explicitPublisher?: string): string {
  if (explicitPublisher?.trim()) return explicitPublisher.trim();
  const ogSite = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (ogSite?.[1]) return decodeHtmlEntities(ogSite[1].trim());
  return domain;
}

function detectAccessGate(html: string, title: string): string | null {
  const sample = `${title}\n${html.slice(0, 6000)}`.toLowerCase();
  if (/just a moment\.\.\.|cf-browser-verification|checking your browser before accessing/i.test(sample)) {
    return "Blocked by anti-bot challenge (Cloudflare/browser check). Access was not bypassed.";
  }
  if (/verify you are human|g-recaptcha|h-captcha|cf-turnstile/i.test(sample)) {
    return "Blocked by CAPTCHA verification. Access was not bypassed.";
  }
  if (/subscribe to continue reading|members-only|sign in to view this page|create an account to read/i.test(sample)) {
    return "Paywall or login gate detected. Evidence Desk does not bypass access controls.";
  }
  return null;
}

export function parseRssOrAtomFeed(
  xml: string,
  fallbackDomain: string
): { title: string; publishedAt: string | null; text: string } {
  const feedTitleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml);
  const feedTitle = feedTitleMatch
    ? stripHtmlTags(feedTitleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))
    : `${fallbackDomain} Feed`;

  const items: string[] = [];
  let latestDate: string | null = null;
  const itemRegex = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = itemRegex.exec(xml)) !== null && count < 8) {
    count++;
    const block = match[1];
    const tMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const dMatch = /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i.exec(block);
    const sMatch = /<(?:description|summary|content[^>]*?)>([\s\S]*?)<\/(?:description|summary|content)>/i.exec(block);

    const itemTitle = tMatch ? stripHtmlTags(tMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")) : "Entry";
    let itemDate: string | null = null;
    if (dMatch?.[1]) {
      const parsed = Date.parse(dMatch[1].trim());
      if (!Number.isNaN(parsed)) {
        itemDate = new Date(parsed).toISOString().slice(0, 10);
        if (!latestDate || itemDate > latestDate) latestDate = itemDate;
      }
    }
    const itemDesc = sMatch
      ? stripHtmlTags(sMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).slice(0, 350)
      : "";

    items.push(`[${itemDate ?? "Date unknown"}] ${itemTitle}${itemDesc ? `: ${itemDesc}` : ""}`);
  }

  return {
    title: feedTitle,
    publishedAt: latestDate,
    text: items.join("\n"),
  };
}

async function checkRobots(urlObj: URL, fetchFn: typeof fetch): Promise<boolean> {
  const origin = urlObj.origin;
  const cached = ROBOTS_CACHE.get(origin);
  if (cached && cached.expiresAt > Date.now()) {
    return isPathAllowedByRobots(urlObj.pathname + urlObj.search, cached.rules);
  }

  try {
    const robotsRes = await fetchFn(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!robotsRes.ok) {
      // Per RFC 9309, 4xx (except 429) on robots.txt implies no disallow rules
      const rules: RobotsRules = robotsRes.status === 429 ? { allow: [], disallow: ["/"] } : { allow: [], disallow: [] };
      ROBOTS_CACHE.set(origin, { rules, expiresAt: Date.now() + 10 * 60_000 });
      return robotsRes.status !== 429;
    }
    const body = await robotsRes.text();
    const rules = parseRobotsTxt(body, "evidencedesk");
    ROBOTS_CACHE.set(origin, { rules, expiresAt: Date.now() + 10 * 60_000 });
    return isPathAllowedByRobots(urlObj.pathname + urlObj.search, rules);
  } catch {
    return true; // Network timeout on robots.txt does not block explicitly user-approved URL check
  }
}

export async function collectApprovedSource(
  input: ApprovedSourceInput,
  fetchFn: typeof fetch = fetch
): Promise<CollectedSourceResult> {
  const retrievedAt = new Date();
  const domain = domainOf(input.url) || "uploaded-document";
  const canon = canonicalUrl(input.url) || input.url.trim();

  // Handle user-uploaded public documents directly without network fetch
  if (input.sourceType === "user_upload") {
    const rawText = input.uploadedText ?? "";
    const sanitized = sanitizeUntrustedText(rawText);
    const trimmed = sanitized.text.slice(0, 6000);
    if (trimmed.length < 15) {
      return {
        label: input.label,
        title: input.label,
        publisher: input.publisher || "User Upload",
        url: input.url,
        canonicalUrl: canon,
        domain: "uploaded-document",
        publishedAt: null,
        retrievedAt,
        sourceType: "user_upload",
        isOfficial: Boolean(input.isOfficial),
        contentHash: computeContentHash(""),
        normalizedText: "",
        fetchStatus: "failed",
        fetchError: "Uploaded document has no readable text.",
        injectionSignals: sanitized.signals,
      };
    }
    return {
      label: input.label,
      title: input.label,
      publisher: input.publisher || "User Upload",
      url: input.url,
      canonicalUrl: canon,
      domain: "uploaded-document",
      publishedAt: null,
      retrievedAt,
      sourceType: "user_upload",
      isOfficial: Boolean(input.isOfficial),
      contentHash: computeContentHash(trimmed),
      normalizedText: trimmed,
      fetchStatus: "ok",
      injectionSignals: sanitized.signals,
    };
  }

  // SSRF / safe public URL guard
  if (!isSafePublicUrl(input.url)) {
    return {
      label: input.label,
      title: input.label,
      publisher: input.publisher || domain,
      url: input.url,
      canonicalUrl: canon,
      domain,
      publishedAt: null,
      retrievedAt,
      sourceType: input.sourceType,
      isOfficial: Boolean(input.isOfficial),
      contentHash: "",
      normalizedText: "",
      fetchStatus: "blocked",
      fetchError: "URL rejected by public-network safety check (private, loopback, or non-HTTP URLs are disallowed).",
      injectionSignals: [],
    };
  }

  const urlObj = new URL(canon);
  const robotsOk = await checkRobots(urlObj, fetchFn);
  if (!robotsOk) {
    return {
      label: input.label,
      title: input.label,
      publisher: input.publisher || domain,
      url: input.url,
      canonicalUrl: canon,
      domain,
      publishedAt: null,
      retrievedAt,
      sourceType: input.sourceType,
      isOfficial: Boolean(input.isOfficial),
      contentHash: "",
      normalizedText: "",
      fetchStatus: "robots_disallowed",
      fetchError: "robots.txt disallows automated collection of this path (RFC 9309 respected).",
      injectionSignals: [],
    };
  }

  try {
    const res = await fetchFn(canon, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return {
        label: input.label,
        title: input.label,
        publisher: input.publisher || domain,
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt: null,
        retrievedAt,
        sourceType: input.sourceType,
        isOfficial: Boolean(input.isOfficial),
        contentHash: "",
        normalizedText: "",
        fetchStatus: "blocked",
        fetchError: `Source declined request with HTTP ${res.status}. Access control or rate limit respected.`,
        injectionSignals: [],
      };
    }

    if (!res.ok) {
      return {
        label: input.label,
        title: input.label,
        publisher: input.publisher || domain,
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt: null,
        retrievedAt,
        sourceType: input.sourceType,
        isOfficial: Boolean(input.isOfficial),
        contentHash: "",
        normalizedText: "",
        fetchStatus: "failed",
        fetchError: `Source returned HTTP ${res.status}.`,
        injectionSignals: [],
      };
    }

    const rawBody = (await res.text()).slice(0, MAX_BODY_BYTES);
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";

    // RSS / Atom feed handling
    if (
      input.sourceType === "rss_feed" ||
      contentType.includes("rss") ||
      contentType.includes("atom") ||
      /^\s*<\?xml[\s\S]{0,200}<(?:rss|feed)/i.test(rawBody)
    ) {
      const feed = parseRssOrAtomFeed(rawBody, domain);
      const sanitized = sanitizeUntrustedText(feed.text);
      return {
        label: input.label,
        title: feed.title || input.label,
        publisher: input.publisher || domain,
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt: feed.publishedAt,
        retrievedAt,
        sourceType: "rss_feed",
        isOfficial: Boolean(input.isOfficial),
        contentHash: computeContentHash(sanitized.text),
        normalizedText: sanitized.text.slice(0, 6000),
        fetchStatus: sanitized.text.length >= 20 ? "ok" : "failed",
        fetchError: sanitized.text.length >= 20 ? undefined : "Feed contained no readable entries.",
        injectionSignals: sanitized.signals,
      };
    }

    // Plain text / Markdown handling
    if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
      const sanitized = sanitizeUntrustedText(rawBody);
      return {
        label: input.label,
        title: input.label,
        publisher: input.publisher || domain,
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt: null,
        retrievedAt,
        sourceType: input.sourceType,
        isOfficial: Boolean(input.isOfficial),
        contentHash: computeContentHash(sanitized.text),
        normalizedText: sanitized.text.slice(0, 6000),
        fetchStatus: "ok",
        injectionSignals: sanitized.signals,
      };
    }

    // HTML page extraction
    const title = extractTitleFromHtml(rawBody, input.label);
    const gateReason = detectAccessGate(rawBody, title);
    if (gateReason) {
      return {
        label: input.label,
        title,
        publisher: extractPublisherFromHtml(rawBody, domain, input.publisher),
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt: null,
        retrievedAt,
        sourceType: input.sourceType,
        isOfficial: Boolean(input.isOfficial),
        contentHash: "",
        normalizedText: "",
        fetchStatus: "blocked",
        fetchError: gateReason,
        injectionSignals: [],
      };
    }

    const publishedAt = extractPublishedDateFromHtml(rawBody);
    const publisher = extractPublisherFromHtml(rawBody, domain, input.publisher);
    const stripped = stripHtmlTags(rawBody);
    const sanitized = sanitizeUntrustedText(stripped);
    const text = sanitized.text.slice(0, 6000);

    if (text.length < 30) {
      return {
        label: input.label,
        title,
        publisher,
        url: input.url,
        canonicalUrl: canon,
        domain,
        publishedAt,
        retrievedAt,
        sourceType: input.sourceType,
        isOfficial: Boolean(input.isOfficial),
        contentHash: "",
        normalizedText: "",
        fetchStatus: "failed",
        fetchError: "Page contained too little extractable public text (may require client-side JavaScript).",
        injectionSignals: sanitized.signals,
      };
    }

    return {
      label: input.label,
      title,
      publisher,
      url: input.url,
      canonicalUrl: canon,
      domain,
      publishedAt,
      retrievedAt,
      sourceType: input.sourceType,
      isOfficial: Boolean(input.isOfficial),
      contentHash: computeContentHash(text),
      normalizedText: text,
      fetchStatus: "ok",
      injectionSignals: sanitized.signals,
    };
  } catch (err) {
    return {
      label: input.label,
      title: input.label,
      publisher: input.publisher || domain,
      url: input.url,
      canonicalUrl: canon,
      domain,
      publishedAt: null,
      retrievedAt,
      sourceType: input.sourceType,
      isOfficial: Boolean(input.isOfficial),
      contentHash: "",
      normalizedText: "",
      fetchStatus: "failed",
      fetchError: err instanceof Error ? err.message : "Network error while fetching source.",
      injectionSignals: [],
    };
  }
}
