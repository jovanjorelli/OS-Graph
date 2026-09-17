import { describe, it, expect } from 'vitest';
import {
  applyAdaptiveConstellationLayout,
  generateGenerationalOrb,
  selectAdaptiveShape,
  SHAPE_TEMPLATES,
  SECTOR_CENTERS,
} from './layout';
import type { OperatingSystemNode, OperatingSystemFamily, LineageLink } from '../types/os';

function createMockNode(id: string, family: OperatingSystemFamily, significance = 1, year = 2000): OperatingSystemNode {
  return {
    id,
    name: `Node ${id}`,
    family,
    kernelType: 'monolithic',
    kernelName: 'Test Kernel',
    inceptionYear: year,
    developer: 'Community',
    license: 'GPL',
    status: 'active',
    architectures: ['x86-64'],
    wikipediaTitle: id,
    wikidataId: `Q${id}`,
    description: 'Test description',
    significance,
    sitelinks: significance * 5,
    x: 0,
    y: 0,
    fx: 0,
    fy: 0,
  };
}

describe('Generational Radial Orb Layout Engine', () => {
  it('selects star cluster for ultra small counts and orb for standard counts', () => {
    expect(selectAdaptiveShape('linux', 3)).toBe(SHAPE_TEMPLATES.star);
    expect(selectAdaptiveShape('apple', 1)).toBe(SHAPE_TEMPLATES.star);
    expect(selectAdaptiveShape('linux', 50)).toBe(SHAPE_TEMPLATES.orb);
    expect(selectAdaptiveShape('bsd', 15)).toBe(SHAPE_TEMPLATES.orb);
  });

  it('folds parent-child-grandchild relationships radially outwards from center', () => {
    const parent = createMockNode('parent-os', 'linux', 10, 1991);
    const child = createMockNode('child-os', 'linux', 8, 1993);
    const grandchild = createMockNode('grandchild-os', 'linux', 6, 2004);
    const mockNodes = [parent, child, grandchild];

    const mockLinks: LineageLink[] = [
      { source: 'parent-os', target: 'child-os', relationType: 'based_on' },
      { source: 'child-os', target: 'grandchild-os', relationType: 'based_on' },
    ];

    const center = SECTOR_CENTERS.linux;
    generateGenerationalOrb(mockNodes, center, mockLinks);

    expect(parent.x).toBe(center.x);
    expect(parent.y).toBe(center.y);

    const childRadius = Math.hypot(child.x! - center.x, child.y! - center.y);
    const grandchildRadius = Math.hypot(grandchild.x! - center.x, grandchild.y! - center.y);

    expect(childRadius).toBeGreaterThan(100);
    expect(grandchildRadius).toBeGreaterThan(childRadius);

    expect(parent.z).toBeDefined();
    expect(child.z).toBeDefined();
    expect(grandchild.z).toBeDefined();
    expect(parent.z!).toBeGreaterThanOrEqual(child.z!);
    expect(child.z!).toBeGreaterThanOrEqual(grandchild.z!);
  });

  it('folds filtered nodes into compact symmetrical layouts without zero-coordinate collapse', () => {
    const families: OperatingSystemFamily[] = ['linux', 'apple', 'bsd', 'windows', 'unix', 'independent'];
    const nodes: OperatingSystemNode[] = [];

    families.forEach((fam) => {
      for (let i = 0; i < 15; i++) {
        nodes.push(createMockNode(`${fam}-${i}`, fam, i % 5, 1980 + i));
      }
    });

    applyAdaptiveConstellationLayout(nodes);

    nodes.forEach((node) => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.fx).toBe(node.x);
      expect(node.fy).toBe(node.y);
    });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.family === b.family) {
          const dist = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
          expect(dist).toBeGreaterThanOrEqual(65);
        }
      }
    }
  });

  it('guarantees min spacing for large clusters', () => {
    const largeLinuxNodes: OperatingSystemNode[] = [];
    for (let i = 0; i < 120; i++) {
      largeLinuxNodes.push(createMockNode(`linux-${i}`, 'linux', i % 10, 1991 + (i % 30)));
    }

    applyAdaptiveConstellationLayout(largeLinuxNodes);

    for (let i = 0; i < largeLinuxNodes.length; i++) {
      for (let j = i + 1; j < largeLinuxNodes.length; j++) {
        const a = largeLinuxNodes[i];
        const b = largeLinuxNodes[j];
        const dist = Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
        expect(dist).toBeGreaterThanOrEqual(65);
      }
    }
  });
});
