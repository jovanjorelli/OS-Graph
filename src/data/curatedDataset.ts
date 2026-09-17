import fullDataset from './operatingSystemsFull.json';
import type { OperatingSystemNode, LineageLink } from '../types/os';
import { applyAdaptiveConstellationLayout } from '../utils/layout';

const rawNodes = fullDataset.nodes as OperatingSystemNode[];
const rawLinks = fullDataset.links as LineageLink[];

const notableIdSet = new Set<string>();

for (let i = 0; i < rawNodes.length; i++) {
  const node = rawNodes[i];
  if ((node.sitelinks || 0) >= 5) {
    notableIdSet.add(node.id);
  }
}

for (let i = 0; i < rawLinks.length; i++) {
  const link = rawLinks[i];
  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  if (notableIdSet.has(targetId as string)) {
    notableIdSet.add(sourceId as string);
  }
}

export const CURATED_NODES: OperatingSystemNode[] = rawNodes.filter((node) =>
  notableIdSet.has(node.id)
);

const curatedIdSet = new Set<string>(CURATED_NODES.map((n) => n.id));

export const CURATED_LINKS: LineageLink[] = rawLinks.filter((link) => {
  const targetId = typeof link.target === 'object' ? link.target.id : link.target;
  const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
  return curatedIdSet.has(sourceId as string) && curatedIdSet.has(targetId as string);
});

applyAdaptiveConstellationLayout(CURATED_NODES, CURATED_LINKS);
