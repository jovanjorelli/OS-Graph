import type { WikipediaSummary, WikipediaPhoto } from '../types/os';

const summaryCache = new Map<string, WikipediaSummary>();
const inFlightRequests = new Map<string, Promise<WikipediaSummary | null>>();
const STORAGE_CACHE_KEY = 'os_wiki_cache_v6';

export function isTrustedWikimediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'wikipedia.org' ||
      host.endsWith('.wikipedia.org') ||
      host === 'wikimedia.org' ||
      host.endsWith('.wikimedia.org')
    );
  } catch {
    return false;
  }
}

function getWikiApiLang(lang: string): string {
  if (lang.startsWith('en')) return 'en';
  return lang;
}

function loadCacheFromStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of Object.keys(parsed)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        const val = (parsed as Record<string, unknown>)[key];
        if (val && typeof val === 'object' && 'title' in val && 'extract' in val) {
          summaryCache.set(key, val as WikipediaSummary);
        }
      }
    }
  } catch {}
}

function persistCacheEntry(key: string, summary: WikipediaSummary): void {
  if (typeof localStorage === 'undefined') return;
  if (!summary.extract && (!summary.albumPhotos || summary.albumPhotos.length === 0)) return;
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    const parsed: Record<string, WikipediaSummary> = raw ? JSON.parse(raw) : Object.create(null);
    parsed[key] = summary;
    const keys = Object.keys(parsed);
    if (keys.length > 300) {
      delete parsed[keys[0]];
    }
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

loadCacheFromStorage();

interface ActionApiPage {
  pageid?: number;
  title?: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

const DISALLOWED_MEDIA_TERMS = [
  'video game',
  'strategy game',
  'computer game',
  'card game',
  'board game',
  'role-playing game',
  'franchise',
  'film',
  'movie',
  'television series',
  'tv series',
  'novel',
  'fictional character',
  'character in',
  'music album',
  'song by',
  'musician',
  'rock band',
  'musical group',
  'village',
  'municipality',
  'town in',
  'river in',
  'company',
  'corporation',
];

export function isMediaOrNonSoftware(text: string): boolean {
  const lower = text.toLowerCase();
  return DISALLOWED_MEDIA_TERMS.some((term) => lower.includes(term));
}

const STOP_WORDS = new Set([
  'operating',
  'system',
  'systems',
  'os',
  'linux',
  'distribution',
  'distro',
  'software',
  'the',
  'and',
  'for',
  'gnu',
  'project',
  'edition',
  'version',
  'of',
]);

export function isCandidateTitleRelevant(
  candidateTitle: string,
  targetName: string,
  targetTitle: string
): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[-_/\\()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const cTitle = clean(candidateTitle);
  const tName = clean(targetName);
  const tTitle = clean(targetTitle);

  if (isMediaOrNonSoftware(cTitle)) return false;

  if (cTitle === tName || cTitle === tTitle) return true;
  if (cTitle.startsWith(tName) || cTitle.startsWith(tTitle)) return true;
  if (tName.startsWith(cTitle) || tTitle.startsWith(cTitle)) return true;

  const tokenize = (str: string) =>
    str
      .replace(/([a-z])([0-9A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  const targetTokens = Array.from(new Set([...tokenize(targetName), ...tokenize(targetTitle)]));
  if (targetTokens.length === 0) return true;

  const candidateTokens = Array.from(new Set(tokenize(candidateTitle)));
  if (candidateTokens.length === 0) return false;

  const sharedTokens = targetTokens.filter((tok) => candidateTokens.includes(tok));
  if (sharedTokens.length === 0) return false;

  const candidateOverlap = sharedTokens.length / candidateTokens.length;
  const targetOverlap = sharedTokens.length / targetTokens.length;

  if (candidateTokens.length >= 3 && candidateOverlap < 0.4) {
    return false;
  }

  return candidateOverlap >= 0.33 || targetOverlap >= 0.5;
}

function isComputingRelated(text: string, lang = 'en'): boolean {
  if (isMediaOrNonSoftware(text)) return false;
  if (getWikiApiLang(lang) !== 'en') return true;
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

function safeFetch(url: string, signal?: AbortSignal, timeoutMs = 3200): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
  return fetch(url, {
    signal: combinedSignal,
    headers: {
      'Api-User-Agent': 'OSGraph/1.0.0 (https://github.com/jovanjorelli/OS-Graph; educational research)',
    },
  }).finally(() => clearTimeout(timer));
}

function cleanWikipediaExtract(text: string): string {
  return text
    .replace(/\s*\(\s*(?:;|\/|\[)?[^)]*?(?:\/|\])?\s*\)/g, (match) => {
      if (match.includes(';') || match.includes('/') || /^\s*\(\s*\)\s*$/.test(match)) {
        return '';
      }
      return match;
    })
    .replace(/\s*\(\s*(?:;\s*)?\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function queryBatchActionApi(
  titles: string[],
  lang = 'en',
  signal?: AbortSignal
): Promise<WikipediaSummary | null> {
  const cleanTitles = Array.from(
    new Set(
      titles
        .map((t) => t.trim().replace(/_/g, ' '))
        .filter((t) => t.length > 0)
    )
  );
  if (cleanTitles.length === 0) return null;

  const wikiLang = getWikiApiLang(lang);
  const batchQuery = cleanTitles.map(encodeURIComponent).join('|');
  const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=5&redirects=1&piprop=thumbnail|original&pithumbsize=2048&format=json&origin=*&titles=${batchQuery}`;

  try {
    const response = await safeFetch(url, signal);
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data?.query?.pages as Record<string, ActionApiPage> | undefined;
    if (!pages) return null;

    const normalizedLookup = new Map<string, ActionApiPage>();
    for (const page of Object.values(pages)) {
      if (!page.title || page.pageid === -1 || !page.extract) continue;
      normalizedLookup.set(page.title.toLowerCase(), page);
    }

    const normalizedRedirects = new Map<string, string>();
    const redirects = data?.query?.redirects as Array<{ from: string; to: string }> | undefined;
    if (Array.isArray(redirects)) {
      for (const r of redirects) {
        normalizedRedirects.set(r.from.toLowerCase(), r.to.toLowerCase());
      }
    }

    for (const target of cleanTitles) {
      const directKey = target.toLowerCase();
      const redirectedKey = normalizedRedirects.get(directKey) || directKey;
      const match = normalizedLookup.get(redirectedKey) || normalizedLookup.get(directKey);
      if (match && match.extract && match.extract.length >= 20 && isComputingRelated(match.extract, wikiLang)) {
        const candidateThumb = match.original?.source?.endsWith('.svg')
          ? match.original.source
          : match.thumbnail?.source || match.original?.source;
        const validThumb = candidateThumb && isTrustedWikimediaUrl(candidateThumb) ? candidateThumb : undefined;
        const validPageUrl = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(match.title || target)}`;

        return {
          title: match.title || target,
          extract: cleanWikipediaExtract(match.extract),
          thumbnailUrl: validThumb,
          pageUrl: validPageUrl,
          lang,
          isFallback: false,
        };
      }
    }

    for (const match of normalizedLookup.values()) {
      if (match.extract && match.extract.length >= 20 && isComputingRelated(match.extract, wikiLang)) {
        const candidateThumb = match.original?.source?.endsWith('.svg')
          ? match.original.source
          : match.thumbnail?.source || match.original?.source;
        const validThumb = candidateThumb && isTrustedWikimediaUrl(candidateThumb) ? candidateThumb : undefined;
        const validPageUrl = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(match.title || '')}`;

        return {
          title: match.title || '',
          extract: cleanWikipediaExtract(match.extract),
          thumbnailUrl: validThumb,
          pageUrl: validPageUrl,
          lang,
          isFallback: false,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function searchWikipediaTitle(
  query: string,
  lang = 'en',
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const wikiLang = getWikiApiLang(lang);
    const searchUrl = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;

    const response = await safeFetch(searchUrl, signal);
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

async function fetchLocalizedTitleViaLanglinks(
  title: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const cleanTitle = title.trim().replace(/_/g, ' ');
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=${encodeURIComponent(
      cleanTitle
    )}&lllang=${encodeURIComponent(targetLang)}&format=json&origin=*`;
    const response = await safeFetch(url, signal);
    if (!response.ok) return null;
    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return null;
    const langlinks = pages[pageId]?.langlinks;
    if (Array.isArray(langlinks) && langlinks.length > 0 && langlinks[0]?.['*']) {
      return langlinks[0]['*'];
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAllLanglinks(
  cleanTitle: string,
  signal?: AbortSignal
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&titles=${encodeURIComponent(
      cleanTitle
    )}&lllimit=500&format=json&origin=*`;
    const response = await safeFetch(url, signal);
    if (!response.ok) return result;
    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== 'object') return result;
    const page = Object.values(pages)[0] as { langlinks?: Array<{ lang?: string; '*'?: string }> } | undefined;
    if (Array.isArray(page?.langlinks)) {
      for (const item of page.langlinks) {
        if (item?.lang && item['*']) {
          result.set(item.lang, item['*']);
        }
      }
    }
    return result;
  } catch {
    return result;
  }
}

async function resolveEnglishSummary(
  normalizedTitle: string,
  systemName?: string,
  signal?: AbortSignal
): Promise<WikipediaSummary | null> {
  const candidates = [normalizedTitle];
  if (systemName && systemName !== normalizedTitle) {
    candidates.push(systemName);
  }
  if (systemName) {
    candidates.push(`${systemName} (operating system)`);
    candidates.push(`${systemName} (Linux distribution)`);
  }
  candidates.push(`${normalizedTitle} (operating system)`);

  let enSummary = await queryBatchActionApi(candidates, 'en', signal);
  if (!enSummary) {
    const searchCandidate = await searchWikipediaTitle(
      `${systemName || normalizedTitle} operating system`,
      'en',
      signal
    );
    if (
      searchCandidate &&
      isCandidateTitleRelevant(searchCandidate, systemName || normalizedTitle, normalizedTitle)
    ) {
      enSummary = await queryBatchActionApi([searchCandidate], 'en', signal);
    }
  }
  return enSummary;
}

function getCanonicalImageKey(url: string): string {
  try {
    const clean = decodeURIComponent(url.split('?')[0]);
    const parts = clean.split('/');
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (/^\d+px-/.test(part)) {
        return part.replace(/^\d+px-/, '').toLowerCase();
      }
    }
    return (parts[parts.length - 1] || url).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

const IGNORE_PATTERNS = [
  /padlock/i,
  /semi[-_ ]protection/i,
  /protection[-_ ]/i,
  /page[-_ ]protected/i,
  /administrator/i,
  /user[-_ ]icon/i,
  /profile[-_ ]icon/i,
  /placeholder/i,
  /avatar/i,
  /login[-_ ]/i,
  /commons[-_ ]logo/i,
  /broom/i,
  /symbol[-_ ]/i,
  /notification[-_ ]icon/i,
  /gear[-_ ]icon/i,
  /gnu[-_ ]white/i,
  /free[-_ ]and[-_ ]open/i,
  /folder[-_ ]hexagonal/i,
  /disc[-_ ]plain/i,
  /ambox/i,
  /question[-_ ]book/i,
  /portal[-_ ]puzzle/i,
  /nuvola/i,
  /crystal[-_ ]clear/i,
  /edit[-_ ]clear/i,
  /lock[-_ ]/i,
  /pd[-_ ]icon/i,
  /disambig/i,
  /wikiquote/i,
  /wikibooks/i,
  /wikinews/i,
  /wikisource/i,
  /wiktionary/i,
  /wikidata/i,
  /red[-_ ]pencile/i,
  /arrow[-_ ]/i,
  /audio/i,
  /sound/i,
  /speaker/i,
  /mime/i,
  /stub/i,
  /feed-icon/i,
  /star[-_ ]featured/i,
  /searchtool/i,
  /clipart/i,
  /oojs/i,
  /dialog[-_ ]/i,
  /translation/i,
  /newtux/i,
];

const LANG_BADGE_MAP: Record<string, string> = {
  en: '🇺🇸 EN',
  'en-gb': '🇬🇧 UK',
  ru: '🇷🇺 RU',
  uk: '🇺🇦 UA',
  de: '🇩🇪 DE',
  fr: '🇫🇷 FR',
  es: '🇪🇸 ES',
  pt: '🇧🇷 PT',
  ar: '🇸🇦 AR',
  ja: '🇯🇵 JA',
  zh: '🇨🇳 ZH',
  hi: '🇮🇳 HI',
};

function isLegitimateOsImage(title: string, width?: number, height?: number, mime?: string): boolean {
  if (mime && !mime.startsWith('image/')) return false;
  if (width && height && (width < 60 || height < 40)) return false;
  return !IGNORE_PATTERNS.some((p) => p.test(title));
}

async function fetchArticleImages(
  cleanTitle: string,
  lang = 'en',
  signal?: AbortSignal
): Promise<string[]> {
  try {
    const wikiLang = getWikiApiLang(lang);
    const url = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&generator=images&titles=${encodeURIComponent(
      cleanTitle
    )}&redirects=1&gimlimit=50&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
    const response = await safeFetch(url, signal, 8000);
    if (!response.ok) return [];
    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== 'object') return [];
    const urls: string[] = [];
    for (const page of Object.values(pages) as any[]) {
      const info = page?.imageinfo?.[0];
      if (
        info?.url &&
        isTrustedWikimediaUrl(info.url) &&
        isLegitimateOsImage(page.title || '', info.width, info.height, info.mime)
      ) {
        urls.push(info.url);
      }
    }
    return urls;
  } catch {
    return [];
  }
}

export async function fetchWikipediaSummary(
  title: string,
  systemName?: string,
  lang = 'en',
  signal?: AbortSignal,
  onProgressiveUpdate?: (summary: WikipediaSummary) => void
): Promise<WikipediaSummary | null> {
  const normalizedTitle = title.trim().replace(/\s+/g, '_');
  const cacheKey = `${normalizedTitle}::${systemName || ''}::${lang}`;

  const cached = summaryCache.get(cacheKey);
  if (cached && cached.albumPhotos && cached.albumPhotos.length > 0) {
    if (onProgressiveUpdate) {
      onProgressiveUpdate({ ...cached });
    }
    return cached;
  }
  if (cached && onProgressiveUpdate) {
    onProgressiveUpdate({ ...cached });
  }

  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    const result = await existingInFlight;
    if (result && onProgressiveUpdate) {
      onProgressiveUpdate({ ...result });
    }
    return result;
  }

  const fetchPromise = (async (): Promise<WikipediaSummary | null> => {
    const wikiLang = getWikiApiLang(lang);
    let summary: WikipediaSummary | null = null;

    if (wikiLang !== 'en') {
      const localizedCandidates = [normalizedTitle];
      if (systemName && systemName !== normalizedTitle) {
        localizedCandidates.push(systemName);
      }
      summary = await queryBatchActionApi(localizedCandidates, wikiLang, signal);

      if (!summary) {
        const [linkedByTitle, linkedByName] = await Promise.allSettled([
          fetchLocalizedTitleViaLanglinks(normalizedTitle, wikiLang, signal),
          systemName ? fetchLocalizedTitleViaLanglinks(systemName, wikiLang, signal) : Promise.resolve(null),
        ]);

        const langlinkTitles: string[] = [];
        if (linkedByTitle.status === 'fulfilled' && linkedByTitle.value) {
          langlinkTitles.push(linkedByTitle.value);
        }
        if (linkedByName.status === 'fulfilled' && linkedByName.value) {
          langlinkTitles.push(linkedByName.value);
        }

        if (langlinkTitles.length > 0) {
          summary = await queryBatchActionApi(langlinkTitles, wikiLang, signal);
        }
      }

      if (!summary && systemName) {
        const searchCandidate = await searchWikipediaTitle(systemName, wikiLang, signal);
        if (searchCandidate) {
          summary = await queryBatchActionApi([searchCandidate], wikiLang, signal);
        }
      }
    }

    const enSummary = await resolveEnglishSummary(normalizedTitle, systemName, signal);

    if (!summary && enSummary) {
      summary = {
        ...enSummary,
        isFallback: wikiLang !== 'en',
        requestedLang: lang,
      };
    }

    if (!summary) {
      return null;
    }

    if (onProgressiveUpdate) {
      onProgressiveUpdate({ ...summary });
    }

    const rawAlbumCandidates: Array<{ url: string; lang: string }> = [];
    if (summary.thumbnailUrl) {
      rawAlbumCandidates.push({ url: summary.thumbnailUrl, lang });
    }
    if (enSummary?.thumbnailUrl && enSummary.thumbnailUrl !== summary.thumbnailUrl) {
      rawAlbumCandidates.push({ url: enSummary.thumbnailUrl, lang: 'en' });
    }

    const effectiveEnTitle = (enSummary?.title || systemName || normalizedTitle).replace(/_/g, ' ');
    const langlinksMapPromise = fetchAllLanglinks(effectiveEnTitle, signal);
    const enImagesPromise = fetchArticleImages(effectiveEnTitle, 'en', signal);
    const localizedImagesPromise =
      wikiLang !== 'en' && summary.title
        ? fetchArticleImages(summary.title.replace(/_/g, ' '), wikiLang, signal)
        : Promise.resolve([]);

    const [langlinksMap, enImages, localizedImages] = await Promise.all([
      langlinksMapPromise,
      enImagesPromise,
      localizedImagesPromise,
    ]);

    if (Array.isArray(enImages)) {
      for (const u of enImages) {
        rawAlbumCandidates.push({ url: u, lang: 'en' });
      }
    }

    if (Array.isArray(localizedImages)) {
      for (const u of localizedImages) {
        rawAlbumCandidates.push({ url: u, lang: wikiLang });
      }
    }

    const candidateLangs = ['ru', 'uk', 'de', 'fr', 'es', 'ja', 'zh', 'pt', 'it'].filter(
      (l) => l !== wikiLang && langlinksMap.has(l)
    );

    const auxiliaryPromises = candidateLangs.slice(0, 5).map(async (auxLang) => {
      const auxTitle = langlinksMap.get(auxLang);
      if (!auxTitle) return { lang: auxLang, thumb: null, images: [] };
      const [sum, imgs] = await Promise.all([
        queryBatchActionApi([auxTitle], auxLang, signal),
        fetchArticleImages(auxTitle.replace(/_/g, ' '), auxLang, signal),
      ]);
      return { lang: auxLang, thumb: sum?.thumbnailUrl || null, images: imgs };
    });

    const auxiliaryResults = await Promise.allSettled(auxiliaryPromises);
    for (const r of auxiliaryResults) {
      if (r.status === 'fulfilled') {
        if (r.value.thumb) {
          rawAlbumCandidates.push({ url: r.value.thumb, lang: r.value.lang });
        }
        for (const u of r.value.images) {
          rawAlbumCandidates.push({ url: u, lang: r.value.lang });
        }
      }
    }

    const seenImageKeys = new Set<string>();
    const finalAlbum: string[] = [];
    const finalAlbumPhotos: WikipediaPhoto[] = [];

    for (const cand of rawAlbumCandidates) {
      if (!cand.url) continue;
      const key = getCanonicalImageKey(cand.url);
      if (!seenImageKeys.has(key)) {
        seenImageKeys.add(key);
        finalAlbum.push(cand.url);
        const badge = LANG_BADGE_MAP[cand.lang] || '🌐 Wiki';
        finalAlbumPhotos.push({
          url: cand.url,
          sourceLang: cand.lang,
          badge,
        });
      }
    }

    const enrichedSummary: WikipediaSummary = {
      ...summary,
      album: finalAlbum,
      albumPhotos: finalAlbumPhotos,
      thumbnailUrl: summary.thumbnailUrl || (finalAlbum.length > 0 ? finalAlbum[0] : undefined),
    };

    summaryCache.set(cacheKey, enrichedSummary);
    persistCacheEntry(cacheKey, enrichedSummary);

    if (onProgressiveUpdate) {
      onProgressiveUpdate({ ...enrichedSummary });
    }

    return enrichedSummary;
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

