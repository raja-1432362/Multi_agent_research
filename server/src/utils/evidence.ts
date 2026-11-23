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
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
