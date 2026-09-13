import { describe, it, expect } from 'vitest';
import { computeAncestryPaths, findLowestCommonAncestor } from './lca';
import type { OperatingSystemNode } from '../types/os';

describe('LCA & Ancestry Algorithms', () => {
  const mockNode = (id: string, name: string, year: number): OperatingSystemNode => ({
    id,
    name,
    inceptionYear: year,
    family: 'unix',
    kernelType: 'monolithic',
    developer: 'Lab',
    license: 'Open',
    status: 'historic',
    sitelinks: 10,
    significance: 2,
    kernelName: 'Kernel',
    architectures: ['x86'],
    wikipediaTitle: name,
  });

  const unix = mockNode('unix', 'Research Unix', 1969);
  const bsd = mockNode('bsd', 'BSD', 1977);
  const freebsd = mockNode('freebsd', 'FreeBSD', 1993);
  const minix = mockNode('minix', 'MINIX', 1987);
  const linux = mockNode('linux', 'Linux Kernel', 1991);
  const dos = mockNode('dos', 'MS-DOS', 1981);

  const nodeMap = new Map<string, OperatingSystemNode>([
    ['unix', unix],
    ['bsd', bsd],
    ['freebsd', freebsd],
    ['minix', minix],
    ['linux', linux],
    ['dos', dos],
  ]);

  const parentMap = new Map<string, string[]>([
    ['bsd', ['unix']],
    ['freebsd', ['bsd']],
    ['minix', ['unix']],
    ['linux', ['minix']],
  ]);

  it('computes full ancestry path chains from descendant to roots', () => {
    const paths = computeAncestryPaths('freebsd', parentMap);
    expect(paths.has('freebsd')).toBe(true);
    expect(paths.get('freebsd')).toEqual(['freebsd']);
    expect(paths.get('bsd')).toEqual(['freebsd', 'bsd']);
    expect(paths.get('unix')).toEqual(['freebsd', 'bsd', 'unix']);
  });

  it('identifies identical node as immediate LCA with zero distance', () => {
    const result = findLowestCommonAncestor('linux', 'linux', parentMap, nodeMap);
    expect(result).not.toBeNull();
    expect(result?.lcaNode.id).toBe('linux');
    expect(result?.sourceDistance).toBe(0);
    expect(result?.targetDistance).toBe(0);
  });

  it('finds lowest common ancestor between related branches', () => {
    const result = findLowestCommonAncestor('freebsd', 'linux', parentMap, nodeMap);
    expect(result).not.toBeNull();
    expect(result?.lcaNode.id).toBe('unix');
    expect(result?.sourceDistance).toBe(2);
    expect(result?.targetDistance).toBe(2);
    expect(result?.pathSource.map((n) => n.id)).toEqual(['freebsd', 'bsd', 'unix']);
    expect(result?.pathTarget.map((n) => n.id)).toEqual(['linux', 'minix', 'unix']);
  });

  it('detects direct parent-child evolutionary relationship', () => {
    const result = findLowestCommonAncestor('freebsd', 'bsd', parentMap, nodeMap);
    expect(result).not.toBeNull();
    expect(result?.lcaNode.id).toBe('bsd');
    expect(result?.sourceDistance).toBe(1);
    expect(result?.targetDistance).toBe(0);
  });

  it('returns null when systems share no ancestral roots', () => {
    const result = findLowestCommonAncestor('freebsd', 'dos', parentMap, nodeMap);
    expect(result).toBeNull();
  });
});
