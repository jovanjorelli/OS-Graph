import type { OperatingSystemNode } from '../types/os';

export interface LcaAnalysisResult {
  lcaNode: OperatingSystemNode;
  pathSource: OperatingSystemNode[];
  pathTarget: OperatingSystemNode[];
  sourceDistance: number;
  targetDistance: number;
}

export function computeAncestryPaths(
  startId: string,
  parentMap: Map<string, string[]>
): Map<string, string[]> {
  const paths = new Map<string, string[]>();
  const queue: [string, string[]][] = [[startId, [startId]]];
  paths.set(startId, [startId]);

  let head = 0;
  while (head < queue.length) {
    const [curr, currentPath] = queue[head++];
    const parents = parentMap.get(curr) || [];
    for (const p of parents) {
      if (!paths.has(p)) {
        const nextPath = [...currentPath, p];
        paths.set(p, nextPath);
        queue.push([p, nextPath]);
      }
    }
  }

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

  const pathsSource = computeAncestryPaths(sourceId, parentMap);
  const pathsTarget = computeAncestryPaths(targetId, parentMap);

  let bestLcaId: string | null = null;
  let minCombinedDist = Infinity;

  pathsSource.forEach((pathA, ancestorId) => {
    if (pathsTarget.has(ancestorId)) {
      const pathB = pathsTarget.get(ancestorId)!;
      const combined = pathA.length + pathB.length;
      if (combined < minCombinedDist) {
        minCombinedDist = combined;
        bestLcaId = ancestorId;
      }
    }
  });

  if (!bestLcaId) return null;

  const lcaNode = nodeMap.get(bestLcaId);
  if (!lcaNode) return null;

  const pathSourceNodes = pathsSource.get(bestLcaId)!.map((id) => nodeMap.get(id)).filter(Boolean) as OperatingSystemNode[];
  const pathTargetNodes = pathsTarget.get(bestLcaId)!.map((id) => nodeMap.get(id)).filter(Boolean) as OperatingSystemNode[];

  return {
    lcaNode,
    pathSource: pathSourceNodes,
    pathTarget: pathTargetNodes,
    sourceDistance: pathSourceNodes.length - 1,
    targetDistance: pathTargetNodes.length - 1,
  };
}
