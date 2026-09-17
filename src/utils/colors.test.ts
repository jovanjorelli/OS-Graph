import { describe, it, expect } from 'vitest';
import { getFamilyColor, getFamilyGlow, getReleaseEra, FAMILY_NEON_PALETTE } from './colors';

describe('Color & Era Utilities', () => {
  it('returns appropriate core color and glow per family', () => {
    expect(getFamilyColor('linux')).toBe(FAMILY_NEON_PALETTE.linux.core);
    expect(getFamilyGlow('windows')).toBe(FAMILY_NEON_PALETTE.windows.glow);
    expect(getFamilyColor('apple')).toBe('#f43f5e');
  });

  it('classifies release years into historical epochs accurately', () => {
    expect(getReleaseEra(1965)).toBe('Mainframe Era');
    expect(getReleaseEra(1975)).toBe('1970s Pioneer Era');
    expect(getReleaseEra(1985)).toBe('1980s PC Era');
    expect(getReleaseEra(1995)).toBe('1990s Desktop Era');
    expect(getReleaseEra(2005)).toBe('2000s Web Era');
    expect(getReleaseEra(2015)).toBe('2010s Cloud Era');
    expect(getReleaseEra(2025)).toBe('2020s Modern Era');
  });
});
