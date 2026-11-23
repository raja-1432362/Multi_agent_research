import { env } from "../../config/env";

export interface SearchHit {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

export interface SearchOptions {
  maxResults: number;
  depth: "basic" | "advanced";
  dateFrom?: string;
  dateTo?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function once(query: string, opts: SearchOptions): Promise<SearchHit[]> {
  const body: Record<string, unknown> = {
    query,
    search_depth: opts.depth, // basic = 1 credit
    max_results: opts.maxResults,
    include_answer: false,
    include_raw_content: false,
  };
  if (opts.dateFrom) body.start_date = opts.dateFrom;
  if (opts.dateTo) body.end_date = opts.dateTo;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.TAVILY_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429 || res.status === 432 || res.status === 433) {
    throw new Error("Tavily quota or rate limit reached. Check your Tavily dashboard.");
  }
  if (!res.ok) throw new Error(`Tavily returned ${res.status}`);
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    content: String(r.content ?? ""),
    publishedDate: r.published_date ? String(r.published_date) : undefined,
  }));
}

/** One retry with backoff, then throw (the caller records the error). */
export async function searchWeb(query: string, opts: SearchOptions): Promise<SearchHit[]> {
  try {
    return await once(query, opts);
  } catch (err) {
    if (err instanceof Error && err.message.includes("quota")) throw err;
    await sleep(1500);
    return once(query, opts);
  }
}
