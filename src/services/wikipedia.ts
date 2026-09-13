import type { WikipediaSummary } from '../types/os';

const summaryCache = new Map<string, WikipediaSummary>();

interface ActionApiPage {
  pageid?: number;
  title?: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

function isComputingRelated(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'operating system',
    'software',
    'kernel',
    'computing',
    'computer',
    'distribution',
    'distro',
    'unix',
    'linux',
    'bsd',
    'hardware',
    'firmware',
    'architecture',
    'platform',
    'system software',
    'processor',
  ];
  return keywords.some((k) => lower.includes(k));
}

async function queryActionApi(
  title: string,
  signal?: AbortSignal
): Promise<WikipediaSummary | null> {
  try {
    const cleanTitle = title.trim().replace(/_/g, ' ');
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&redirects=1&piprop=thumbnail&pithumbsize=500&format=json&origin=*&titles=${encodeURIComponent(
      cleanTitle
    )}`;

    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data?.query?.pages as Record<string, ActionApiPage> | undefined;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return null;

    const page = pages[pageId];
    if (!page.extract || page.extract.length < 20) return null;
    if (!isComputingRelated(page.extract)) return null;

    return {
      title: page.title || title,
      extract: page.extract,
      thumbnailUrl: page.thumbnail?.source,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title || title)}`,
    };
  } catch {
    return null;
  }
}

async function searchWikipediaTitle(
  query: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;

    const response = await fetch(searchUrl, { signal });
    if (!response.ok) return null;

    const data = await response.json();
    const results = data?.query?.search;
    if (Array.isArray(results) && results.length > 0 && results[0]?.title) {
      return results[0].title;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchWikipediaSummary(
  title: string,
  systemName?: string,
  signal?: AbortSignal
): Promise<WikipediaSummary | null> {
  const normalizedTitle = title.trim().replace(/\s+/g, '_');
  const cacheKey = `${normalizedTitle}::${systemName || ''}`;

  const cached = summaryCache.get(cacheKey);
  if (cached) return cached;

  let summary = await queryActionApi(normalizedTitle, signal);

  if (!summary && systemName && systemName !== normalizedTitle) {
    summary = await queryActionApi(systemName, signal);
  }

  if (!summary && systemName) {
    summary = await queryActionApi(`${systemName} (operating system)`, signal);
  }

  if (!summary && systemName) {
    summary = await queryActionApi(`${systemName} (Linux distribution)`, signal);
  }

  if (!summary) {
    const searchCandidate = await searchWikipediaTitle(
      `${systemName || normalizedTitle} operating system`,
      signal
    );
    if (searchCandidate) {
      summary = await queryActionApi(searchCandidate, signal);
    }
  }

  if (summary) {
    summaryCache.set(cacheKey, summary);
  }

  return summary;
}
