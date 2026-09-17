import { describe, it, expect } from 'vitest';
import fullDataset from './operatingSystemsFull.json';
import { CURATED_NODES } from './curatedDataset';
import type { OperatingSystemFamily, KernelType } from '../types/os';

describe('Operating Systems Dataset Integrity', () => {
  const validFamilies: Set<OperatingSystemFamily> = new Set([
    'unix',
    'bsd',
    'linux',
    'windows',
    'apple',
    'independent',
  ]);

  const validKernelTypes: Set<KernelType> = new Set([
    'monolithic',
    'microkernel',
    'hybrid',
    'nanokernel',
    'exokernel',
    'simple',
  ]);

  it('contains over 2,000 systems in full graph dataset', () => {
    expect(fullDataset.nodes.length).toBeGreaterThanOrEqual(2000);
    expect(fullDataset.links.length).toBeGreaterThanOrEqual(1400);
  });

  it('validates each node structure, year boundaries, and valid taxonomies', () => {
    const nodeIds = new Set<string>();

    for (const node of fullDataset.nodes) {
      expect(node.id).toBeTruthy();
      expect(typeof node.id).toBe('string');
      expect(nodeIds.has(node.id)).toBe(false);
      nodeIds.add(node.id);

      expect(node.name).toBeTruthy();
      expect(typeof node.name).toBe('string');

      expect(node.inceptionYear).toBeGreaterThanOrEqual(1950);
      expect(node.inceptionYear).toBeLessThanOrEqual(2030);

      expect(validFamilies.has(node.family as OperatingSystemFamily)).toBe(true);
      expect(validKernelTypes.has(node.kernelType as KernelType)).toBe(true);
    }
  });

  it('verifies that all links connect known source and target nodes', () => {
    const nodeIds = new Set(fullDataset.nodes.map((n) => n.id));

    for (const link of fullDataset.links) {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

      expect(nodeIds.has(sourceId)).toBe(true);
      expect(nodeIds.has(targetId)).toBe(true);
    }
  });

  it('guarantees pre-computed canonical layout coordinates for all curated nodes', () => {
    expect(CURATED_NODES.length).toBe(816);
    for (const node of CURATED_NODES) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(typeof node.z).toBe('number');
      expect(Number.isNaN(node.x)).toBe(false);
      expect(Number.isNaN(node.y)).toBe(false);
      expect(Number.isNaN(node.z)).toBe(false);
    }
  });
});
