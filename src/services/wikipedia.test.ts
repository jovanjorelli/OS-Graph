import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isTrustedWikimediaUrl,
  fetchWikipediaSummary,
  isCandidateTitleRelevant,
  isMediaOrNonSoftware,
} from './wikipedia';

describe('Wikipedia Service Security & Optimization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates trusted Wikimedia domains and rejects malicious protocols or origins', () => {
    expect(isTrustedWikimediaUrl('https://en.wikipedia.org/wiki/Linux')).toBe(true);
    expect(isTrustedWikimediaUrl('https://ru.wikipedia.org/wiki/Ubuntu')).toBe(true);
    expect(isTrustedWikimediaUrl('https://upload.wikimedia.org/wikipedia/commons/3/35/Tux.svg')).toBe(true);
    expect(isTrustedWikimediaUrl('http://en.wikipedia.org/wiki/Linux')).toBe(false);
    expect(isTrustedWikimediaUrl('javascript:alert(1)')).toBe(false);
    expect(isTrustedWikimediaUrl('https://evil-wikipedia.org')).toBe(false);
    expect(isTrustedWikimediaUrl('https://attacker.com/wiki/Linux')).toBe(false);
    expect(isTrustedWikimediaUrl('')).toBe(false);
  });

  it('delivers fast-path summary and progressive updates for operating system query', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('action=query') && url.includes('generator=images')) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                '1': {
                  title: 'File:Ubuntu-logo.png',
                  imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/logo.png', width: 500, height: 500, mime: 'image/png' }],
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      if (url.includes('prop=langlinks')) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                '10': {
                  langlinks: [{ lang: 'ru', '*': 'Ubuntu' }],
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              '100': {
                title: 'Ubuntu',
                extract: 'Ubuntu is a Linux distribution and operating system.',
                thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb.png', width: 300, height: 300 },
              },
            },
          },
        }),
        { status: 200 }
      );
    });

    let progressiveFired = false;
    const summary = await fetchWikipediaSummary(
      'UbuntuTestNode',
      'UbuntuTestNode',
      'en',
      undefined,
      (progressive) => {
        if (progressive.extract) {
          progressiveFired = true;
        }
      }
    );

    expect(summary).not.toBeNull();
    if (summary) {
      expect(summary.title).toBe('Ubuntu');
      expect(summary.extract).toContain('operating system');
      expect(isTrustedWikimediaUrl(summary.pageUrl)).toBe(true);
      if (summary.thumbnailUrl) {
        expect(isTrustedWikimediaUrl(summary.thumbnailUrl)).toBe(true);
      }
      expect(summary.albumPhotos && summary.albumPhotos.length > 0).toBe(true);
    }
    expect(progressiveFired).toBe(true);
  });

  it('resolves localized summary without error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('action=query') && url.includes('generator=images')) {
        return new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 });
      }
      if (url.includes('prop=langlinks')) {
        return new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              '200': {
                title: 'FreeBSD',
                extract: 'FreeBSD — свободная операционная система.',
                thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/freebsd.png', width: 300, height: 300 },
              },
            },
          },
        }),
        { status: 200 }
      );
    });

    const summary = await fetchWikipediaSummary('FreeBSDTestNode', 'FreeBSDTestNode', 'ru');
    expect(summary).not.toBeNull();
    if (summary) {
      expect(summary.title).toBe('FreeBSD');
      expect(summary.extract).toContain('FreeBSD');
      expect(isTrustedWikimediaUrl(summary.pageUrl)).toBe(true);
    }
  });

  it('rejects unrelated search candidate titles and media topics', () => {
    expect(isCandidateTitleRelevant('ChromeOS', 'MagicOS 10', 'MagicOS_10')).toBe(false);
    expect(isCandidateTitleRelevant('Heroes of Might and Magic III', 'MagicOS 10', 'MagicOS_10')).toBe(false);
    expect(isCandidateTitleRelevant('Honor (company)', 'MagicOS 10', 'MagicOS_10')).toBe(false);
    expect(isCandidateTitleRelevant('Ubuntu', 'Ubuntu', 'Ubuntu')).toBe(true);
    expect(isCandidateTitleRelevant('Debian', 'Debian GNU/Linux', 'Debian_GNU/Linux')).toBe(true);
    expect(isCandidateTitleRelevant('OS X Snow Leopard', 'Mac OS X Snow Leopard', 'Mac_OS_X_Snow_Leopard')).toBe(true);

    expect(isMediaOrNonSoftware('Heroes of Might and Magic III is a turn-based strategy video game')).toBe(true);
    expect(isMediaOrNonSoftware('Ubuntu is a Linux distribution based on Debian')).toBe(false);
  });
});
