import type { OperatingSystemNode } from '../types/os';

export interface LcaAnalysisResult {
  lcaNode: OperatingSystemNode;
  pathSource: OperatingSystemNode[];
  pathTarget: OperatingSystemNode[];
  sourceDistance: number;
  targetDistance: number;
}

interface AncestryTree {
  depths: Map<string, number>;
  parentPointers: Map<string, string>;
}

function getAncestryTree(
  startId: string,
  parentMap: Map<string, string[]>,
  maxDepth = 256,
  maxVisited = 4000
): AncestryTree {
  const depths = new Map<string, number>();
  const parentPointers = new Map<string, string>();
  const queue: string[] = [startId];
  depths.set(startId, 0);

  let head = 0;
  while (head < queue.length && head < maxVisited) {
    const curr = queue[head++];
    const currentDepth = depths.get(curr)!;
    if (currentDepth >= maxDepth) continue;

    const parents = parentMap.get(curr);
    if (!parents) continue;

    for (let i = 0; i < parents.length; i++) {
      const p = parents[i];
      if (!depths.has(p)) {
        depths.set(p, currentDepth + 1);
        parentPointers.set(p, curr);
        queue.push(p);
      }
    }
  }

  return { depths, parentPointers };
}

function reconstructPath(ancestorId: string, parentPointers: Map<string, string>): string[] {
  const path: string[] = [];
  let curr: string | undefined = ancestorId;
  while (curr !== undefined) {
    path.push(curr);
    curr = parentPointers.get(curr);
  }
  return path.reverse();
}

export function computeAncestryPaths(
  startId: string,
  parentMap: Map<string, string[]>
): Map<string, string[]> {
  const { depths, parentPointers } = getAncestryTree(startId, parentMap);
  const paths = new Map<string, string[]>();

  depths.forEach((_, ancestorId) => {
    paths.set(ancestorId, reconstructPath(ancestorId, parentPointers));
  });

  return paths;
}

export function findLowestCommonAncestor(
  sourceId: string,
  targetId: string,
  parentMap: Map<string, string[]>,
  nodeMap: Map<string, OperatingSystemNode>
): LcaAnalysisResult | null {
  if (sourceId === targetId) {
    const node = nodeMap.get(sourceId);
    if (!node) return null;
    return {
      lcaNode: node,
      pathSource: [node],
      pathTarget: [node],
      sourceDistance: 0,
      targetDistance: 0,
    };
  }

  const treeSource = getAncestryTree(sourceId, parentMap);
  const treeTarget = getAncestryTree(targetId, parentMap);

  let bestLcaId: string | null = null;
  let minCombinedDist = Infinity;

  treeSource.depths.forEach((distA, ancestorId) => {
    const distB = treeTarget.depths.get(ancestorId);
    if (distB !== undefined) {
      const combined = distA + distB;
      if (combined < minCombinedDist) {
        minCombinedDist = combined;
        bestLcaId = ancestorId;
      }
    }
  });

  if (!bestLcaId) return null;

  const lcaNode = nodeMap.get(bestLcaId);
  if (!lcaNode) return null;

  const pathSourceNodes = reconstructPath(bestLcaId, treeSource.parentPointers)
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as OperatingSystemNode[];

  const pathTargetNodes = reconstructPath(bestLcaId, treeTarget.parentPointers)
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as OperatingSystemNode[];

  return {
    lcaNode,
    pathSource: pathSourceNodes,
    pathTarget: pathTargetNodes,
    sourceDistance: treeSource.depths.get(bestLcaId) ?? (pathSourceNodes.length - 1),
    targetDistance: treeTarget.depths.get(bestLcaId) ?? (pathTargetNodes.length - 1),
  };
}
