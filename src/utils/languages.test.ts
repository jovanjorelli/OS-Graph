import { describe, it, expect, beforeEach } from 'vitest';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getSavedLanguage, saveLanguage, t } from './languages';

describe('Language Utilities', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: 0,
      key: () => null,
    } as Storage;
  });

  it('contains all 12 supported languages with flags and codes', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(12);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['en', 'en-gb', 'ru', 'uk', 'de', 'fr', 'es', 'pt', 'ar', 'ja', 'zh', 'hi']);
  });

  it('defaults to English when no storage is present', () => {
    expect(DEFAULT_LANGUAGE.code).toBe('en');
    expect(getSavedLanguage().code).toBe('en');
  });

  it('persists and retrieves user language preference', () => {
    saveLanguage('uk');
    expect(getSavedLanguage().code).toBe('uk');
    expect(getSavedLanguage().flag).toBe('🇺🇦');
  });

  it('falls back to default language if unknown code is stored', () => {
    localStorage.setItem('os_graph_lang', 'invalid_code');
    expect(getSavedLanguage().code).toBe('en');
  });

  it('provides translations across keys and falls back gracefully', () => {
    expect(t('filters', 'en')).toBe('Filters');
    expect(t('filters', 'ru')).toBe('Фильтры');
    expect(t('filters', 'uk')).toBe('Фільтри');
    expect(t('compare', 'de')).toBe('Vergleichen');
    expect(t('license', 'en')).toBe('License');
    expect(t('license', 'en-gb')).toBe('Licence');
    expect(t('licenseModel', 'en-gb')).toBe('Licence Model');
    expect(t('compare', 'unknown_lang')).toBe('Compare');
  });
});
