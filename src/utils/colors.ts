import type { OperatingSystemFamily, KernelType } from '../types/os';

export interface FamilyColorConfig {
  core: string;
  glow: string;
  filament: string;
}

export const FAMILY_NEON_PALETTE: Record<OperatingSystemFamily, FamilyColorConfig> = {
  unix: {
    core: '#8b5cf6',
    glow: '#a78bfa',
    filament: 'rgba(139, 92, 246, 0.35)',
  },
  bsd: {
    core: '#f59e0b',
    glow: '#fbbf24',
    filament: 'rgba(245, 158, 11, 0.35)',
  },
  linux: {
    core: '#10b981',
    glow: '#34d399',
    filament: 'rgba(16, 185, 129, 0.35)',
  },
  windows: {
    core: '#06b6d4',
    glow: '#38bdf8',
    filament: 'rgba(6, 182, 212, 0.35)',
  },
  apple: {
    core: '#f43f5e',
    glow: '#fb7185',
    filament: 'rgba(244, 63, 94, 0.35)',
  },
  independent: {
    core: '#6366f1',
    glow: '#818cf8',
    filament: 'rgba(99, 102, 241, 0.35)',
  },
};

export const FAMILY_NAMES: Record<OperatingSystemFamily, string> = {
  unix: 'Unix',
  bsd: 'BSD',
  linux: 'Linux',
  windows: 'Windows & DOS',
  apple: 'Apple & macOS',
  independent: 'Independent & Research',
};

export const KERNEL_LABELS: Record<KernelType, string> = {
  monolithic: 'Monolithic Architecture',
  microkernel: 'Microkernel Architecture',
  hybrid: 'Hybrid Architecture',
  nanokernel: 'Nanokernel Architecture',
  exokernel: 'Exokernel Architecture',
  simple: 'Direct Hardware / BIOS',
};

export function getFamilyColor(family: OperatingSystemFamily): string {
  return FAMILY_NEON_PALETTE[family]?.core || '#94a3b8';
}

export function getFamilyGlow(family: OperatingSystemFamily): string {
  return FAMILY_NEON_PALETTE[family]?.glow || '#cbd5e1';
}

export function getReleaseEra(year: number): string {
  if (year < 1970) return 'Mainframe Era';
  if (year < 1980) return '1970s Pioneer Era';
  if (year < 1990) return '1980s PC Era';
  if (year < 2000) return '1990s Desktop Era';
  if (year < 2010) return '2000s Web Era';
  if (year < 2020) return '2010s Cloud Era';
  return '2020s Modern Era';
}

