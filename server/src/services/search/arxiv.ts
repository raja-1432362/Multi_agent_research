export interface ArxivHit {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

export async function searchArxiv(query: string, maxResults = 5): Promise<ArxivHit[]> {
  try {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const xml = await res.text();

    const entries: ArxivHit[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let match: RegExpExecArray | null;

    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1];
      const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(block);
      const summaryMatch = /<summary>([\s\S]*?)<\/summary>/i.exec(block);
      const idMatch = /<id>([\s\S]*?)<\/id>/i.exec(block);
      const pubMatch = /<published>([\s\S]*?)<\/published>/i.exec(block);

      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "arXiv Paper";
      const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";
      const idUrl = idMatch ? idMatch[1].trim() : "";
      const pubDate = pubMatch ? pubMatch[1].slice(0, 10) : undefined;

      if (summary && idUrl) {
        entries.push({
          title,
          url: idUrl,
          content: summary,
          publishedDate: pubDate,
        });
      }
    }
    return entries;
  } catch (err) {
    console.error("arXiv search error:", err);
    return [];
  }
}
