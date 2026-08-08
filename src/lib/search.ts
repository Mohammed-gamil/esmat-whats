import axios from "axios";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function runDork(
  query: string,
  _category: string = "lead_intelligence",
  _sector: string = "B2B",
  options: { serperApiKey?: string; maxResults?: number } = {}
): Promise<SearchResult[]> {
  const serperKey = options.serperApiKey || process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  try {
    const res = await axios.post(
      "https://google.serper.dev/search",
      { q: query, num: options.maxResults || 3 },
      {
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const organic = res.data?.organic || [];
    return organic.map((item: any) => ({
      title: item.title || "",
      url: item.link || "",
      snippet: item.snippet || "",
    }));
  } catch (err: any) {
    console.warn("[runDork] Serper search error:", err?.message);
    return [];
  }
}
