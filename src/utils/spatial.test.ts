import { describe, it, expect } from 'vitest';
import { SpatialNodeGrid } from './spatial';
import type { OperatingSystemNode } from '../types/os';

describe('SpatialNodeGrid Indexer', () => {
  const mockNode = (id: string, x: number, y: number): OperatingSystemNode => ({
    id,
    name: id,
    inceptionYear: 2000,
    family: 'linux',
    kernelType: 'monolithic',
    developer: 'Dev',
    license: 'GPL',
    status: 'active',
    sitelinks: 5,
    significance: 1,
    kernelName: 'Kernel',
    architectures: ['x86'],
    wikipediaTitle: id,
    x,
    y,
  });

  it('indexes nodes and queries closest candidate within threshold', () => {
    const grid = new SpatialNodeGrid(200);
    const n1 = mockNode('node1', 100, 100);
    const n2 = mockNode('node2', 500, 500);
    const n3 = mockNode('node3', 105, 105);

    grid.rebuild([n1, n2, n3]);

    const result = grid.findClosest(102, 102, 20);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('node1');
  });

  it('returns null when query coordinate exceeds max distance', () => {
    const grid = new SpatialNodeGrid(200);
    const n1 = mockNode('node1', 100, 100);
    grid.rebuild([n1]);

    const result = grid.findClosest(800, 800, 50);
    expect(result).toBeNull();
  });
});
