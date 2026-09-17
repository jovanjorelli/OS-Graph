import type { OperatingSystemNode, OperatingSystemFamily, LineageLink } from '../types/os';

export const SECTOR_CENTERS: Record<OperatingSystemFamily, { x: number; y: number }> = {
  unix: { x: 0, y: -3900 },
  apple: { x: -3900, y: -1500 },
  bsd: { x: 3900, y: -1500 },
  windows: { x: -3900, y: 2100 },
  linux: { x: 3900, y: 2100 },
  independent: { x: 0, y: 4500 },
};

export function generateGenerationalOrb(
  nodes: OperatingSystemNode[],
  center: { x: number; y: number },
  links?: LineageLink[]
): void {
  if (nodes.length === 0) return;
  if (nodes.length === 1) {
    nodes[0].x = center.x;
    nodes[0].y = center.y;
    nodes[0].fx = center.x;
    nodes[0].fy = center.y;
    nodes[0].z = 180;
    return;
  }

  const effectiveLinks = links || [];
  const inFamilyIds = new Set(nodes.map((n) => n.id));
  const parentMap = new Map<string, string[]>();
  const childrenMap = new Map<string, string[]>();

  for (let i = 0; i < effectiveLinks.length; i++) {
    const l = effectiveLinks[i];
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (inFamilyIds.has(s as string) && inFamilyIds.has(t as string)) {
      let parents = parentMap.get(t as string);
      if (!parents) {
        parents = [];
        parentMap.set(t as string, parents);
      }
      parents.push(s as string);

      let children = childrenMap.get(s as string);
      if (!children) {
        children = [];
        childrenMap.set(s as string, children);
      }
      children.push(t as string);
    }
  }

  const depths = new Map<string, number>();
  const roots = nodes.filter((n) => {
    const parents = parentMap.get(n.id);
    return !parents || parents.length === 0;
  });

  roots.sort((a, b) => {
    if (b.significance !== a.significance) return b.significance - a.significance;
    return a.inceptionYear - b.inceptionYear;
  });

  for (let i = 0; i < roots.length; i++) {
    depths.set(roots[i].id, 0);
  }

  const queue = roots.map((r) => r.id);
  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currDepth = depths.get(currId) || 0;
    const children = childrenMap.get(currId) || [];
    for (let i = 0; i < children.length; i++) {
      const chId = children[i];
      if (!depths.has(chId)) {
        depths.set(chId, currDepth + 1);
        queue.push(chId);
      }
    }
  }

  let minYear = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].inceptionYear < minYear) {
      minYear = nodes[i].inceptionYear;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!depths.has(n.id)) {
      const eraDepth = Math.max(1, Math.min(4, Math.floor((n.inceptionYear - minYear) / 12) + 1));
      depths.set(n.id, eraDepth);
    }
  }

  const byDepth = new Map<number, OperatingSystemNode[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const d = depths.get(n.id) || 0;
    let list = byDepth.get(d);
    if (!list) {
      list = [];
      byDepth.set(d, list);
    }
    list.push(n);
  }

  const depthKeys = Array.from(byDepth.keys());
  let maxDepth = 0;
  for (let i = 0; i < depthKeys.length; i++) {
    if (depthKeys[i] > maxDepth) {
      maxDepth = depthKeys[i];
    }
  }

  const minSpacing = 70;
  const effectiveAreaPerNode = Math.pow(minSpacing * 1.08, 2);
  const totalRadius = Math.max(180, Math.sqrt((nodes.length * effectiveAreaPerNode) / Math.PI));

  const shellRadii = [0];
  let accumulated = 0;
  for (let d = 0; d <= maxDepth; d++) {
    const layer = byDepth.get(d) || [];
    accumulated += layer.length;
    const rOuter = Math.sqrt(accumulated / nodes.length) * totalRadius;
    shellRadii.push(rOuter);
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let globalIndex = 0;

  for (let d = 0; d <= maxDepth; d++) {
    const layer = byDepth.get(d) || [];
    if (layer.length === 0) continue;

    layer.sort((a, b) => {
      const pA = parentMap.get(a.id)?.[0];
      const pB = parentMap.get(b.id)?.[0];
      if (pA && pB && pA !== pB) {
        return pA.localeCompare(pB);
      }
      return a.inceptionYear - b.inceptionYear;
    });

    const rIn = shellRadii[d];
    const rOut = shellRadii[d + 1];

    if (d === 0 && layer.length === 1) {
      const root = layer[0];
      root.x = center.x;
      root.y = center.y;
      root.fx = center.x;
      root.fy = center.y;
      root.z = Math.round(totalRadius);
      globalIndex++;
      continue;
    }

    for (let k = 0; k < layer.length; k++) {
      const frac = (k + 0.5) / layer.length;
      const r = Math.sqrt(rIn * rIn + frac * (rOut * rOut - rIn * rIn));
      const theta = globalIndex * goldenAngle;
      const x = Math.round(center.x + Math.cos(theta) * r);
      const y = Math.round(center.y + Math.sin(theta) * r);
      const node = layer[k];
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
      node.z = Math.round(Math.sqrt(Math.max(0, totalRadius * totalRadius - r * r)));
      globalIndex++;
    }
  }
}

export function generateStarCluster(nodes: OperatingSystemNode[], center: { x: number; y: number }): void {
  generateGenerationalOrb(nodes, center);
}

export const SHAPE_TEMPLATES = {
  orb: generateGenerationalOrb,
  star: generateStarCluster,
  snowflake: generateGenerationalOrb,
  spiral: generateGenerationalOrb,
  trident: generateGenerationalOrb,
  diamond: generateGenerationalOrb,
  halos: generateGenerationalOrb,
  nebula: generateGenerationalOrb,
};

export function selectAdaptiveShape(
  _family: OperatingSystemFamily,
  nodeCount: number
): (nodes: OperatingSystemNode[], center: { x: number; y: number }, links?: LineageLink[]) => void {
  if (nodeCount <= 4) {
    return SHAPE_TEMPLATES.star;
  }
  return SHAPE_TEMPLATES.orb;
}

export function applyAdaptiveConstellationLayout(
  nodes: OperatingSystemNode[],
  links?: LineageLink[]
): void {
  if (nodes.length === 0) return;

  const byFamily: Record<OperatingSystemFamily, OperatingSystemNode[]> = {
    unix: [],
    apple: [],
    bsd: [],
    windows: [],
    linux: [],
    independent: [],
  };

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (byFamily[node.family]) {
      byFamily[node.family].push(node);
    } else {
      byFamily.independent.push(node);
    }
  }

  const families = Object.keys(byFamily) as OperatingSystemFamily[];
  for (let i = 0; i < families.length; i++) {
    const fam = families[i];
    const famNodes = byFamily[fam];
    if (famNodes.length === 0) continue;

    const center = SECTOR_CENTERS[fam] || SECTOR_CENTERS.independent;
    generateGenerationalOrb(famNodes, center, links);
  }
}
