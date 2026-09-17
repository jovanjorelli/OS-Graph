import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph from 'force-graph';
import type { ForceGraphGeneric } from 'force-graph';
import type { OperatingSystemNode, LineageLink, OperatingSystemFamily } from '../types/os';
import { FAMILY_NEON_PALETTE } from '../utils/colors';
import { SpatialNodeGrid } from '../utils/spatial';
import { getDeviceProfile } from '../utils/device';
import { AdaptivePerformanceGovernor } from '../utils/governor';
import { applyAdaptiveConstellationLayout } from '../utils/layout';

interface GraphCanvasProps {
  nodes: OperatingSystemNode[];
  links: LineageLink[];
  selectedNode: OperatingSystemNode | null;
  onSelectNode: (node: OperatingSystemNode | null) => void;
  selectedFamilies: OperatingSystemFamily[];
  yearRange: [number, number];
  searchQuery: string;
  graphRef: React.MutableRefObject<ForceGraphGeneric<any, OperatingSystemNode, LineageLink> | null>;
}

const FAMILY_LINK_COLORS: Record<OperatingSystemFamily, string> = {
  unix: 'rgba(99, 102, 241, 0.15)',
  apple: 'rgba(168, 85, 247, 0.15)',
  bsd: 'rgba(244, 63, 94, 0.15)',
  windows: 'rgba(14, 165, 233, 0.15)',
  linux: 'rgba(16, 185, 129, 0.15)',
  independent: 'rgba(245, 158, 11, 0.15)',
};

const FONT_CACHE = new Map<string, string>();
function getCachedFont(weight: string, size: number): string {
  const key = `${weight}:${size}`;
  let font = FONT_CACHE.get(key);
  if (!font) {
    font = `${weight} ${size}px 'JetBrains Mono', monospace`;
    FONT_CACHE.set(key, font);
  }
  return font;
}

const TEXT_WIDTH_CACHE = new Map<string, number>();
function getCachedTextWidth(ctx: CanvasRenderingContext2D, font: string, text: string): number {
  const key = `${font}:${text}`;
  let width = TEXT_WIDTH_CACHE.get(key);
  if (width === undefined) {
    width = ctx.measureText(text).width;
    if (TEXT_WIDTH_CACHE.size > 1500) {
      TEXT_WIDTH_CACHE.clear();
    }
    TEXT_WIDTH_CACHE.set(key, width);
  }
  return width;
}

interface NodeSprite {
  canvas: HTMLCanvasElement;
  radius: number;
  size: number;
}

const NODE_SPRITES = new Map<string, NodeSprite>();

function getNodeSprite(family: OperatingSystemFamily, significance: number): NodeSprite {
  const key = `${family}:${significance}`;
  let sprite = NODE_SPRITES.get(key);
  if (sprite) return sprite;

  const palette = FAMILY_NEON_PALETTE[family] || {
    core: '#94a3b8',
    glow: '#cbd5e1',
    filament: 'rgba(148, 163, 184, 0.35)',
  };

  const baseRadius = 5 + significance * 2.2;
  const haloRadius = baseRadius * 1.8;
  const padding = 4;
  const rawSize = Math.ceil((haloRadius + padding) * 2);
  const size = rawSize + (rawSize % 2);
  const center = size / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.beginPath();
    ctx.arc(center, center, haloRadius, 0, Math.PI * 2);
    ctx.fillStyle = palette.filament;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = palette.core;
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  sprite = { canvas, radius: baseRadius, size };
  NODE_SPRITES.set(key, sprite);
  return sprite;
}

const SECTOR_LABELS = [
  { text: 'UNIX', x: 0, y: -4650 },
  { text: 'APPLE & MACOS', x: -3900, y: -2600 },
  { text: 'BSD', x: 3900, y: -2300 },
  { text: 'WINDOWS & DOS', x: -3900, y: 1200 },
  { text: 'LINUX', x: 3900, y: 3800 },
  { text: 'RESEARCH & INDEPENDENT', x: 0, y: 5850 },
];

const SECTOR_GLOBES: Array<{ family: OperatingSystemFamily; x: number; y: number; radius: number }> = [
  { family: 'unix', x: 0, y: -3900, radius: 260 },
  { family: 'apple', x: -3900, y: -1500, radius: 360 },
  { family: 'bsd', x: 3900, y: -1500, radius: 200 },
  { family: 'windows', x: -3900, y: 2100, radius: 390 },
  { family: 'linux', x: 3900, y: 2100, radius: 880 },
  { family: 'independent', x: 0, y: 4500, radius: 700 },
];

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  links,
  selectedNode,
  onSelectNode,
  selectedFamilies,
  yearRange,
  searchQuery,
  graphRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalGraphRef = useRef<ForceGraphGeneric<any, OperatingSystemNode, LineageLink> | null>(null);
  const hoverNodeRef = useRef<OperatingSystemNode | null>(null);
  const selectedNodeRef = useRef<OperatingSystemNode | null>(selectedNode);
  const highlightNodesRef = useRef<Set<string>>(new Set());
  const highlightLinksRef = useRef<Set<LineageLink>>(new Set());
  const ancestorNodesRef = useRef<Set<string>>(new Set());
  const descendantNodesRef = useRef<Set<string>>(new Set());
  const ancestorLinksRef = useRef<Set<LineageLink>>(new Set());
  const descendantLinksRef = useRef<Set<LineageLink>>(new Set());
  const visitedAncestorsRef = useRef<Set<string>>(new Set());
  const isClampingRef = useRef(false);
  const spatialGridRef = useRef(new SpatialNodeGrid(350));
  const renderedLabelCellsRef = useRef<Set<number>>(new Set());
  const deviceProfileRef = useRef(getDeviceProfile());
  const governorRef = useRef(new AdaptivePerformanceGovernor());
  const renderStartTimeRef = useRef(0);

  const viewportBoundsRef = useRef({
    minX: -Infinity,
    maxX: Infinity,
    minY: -Infinity,
    maxY: Infinity,
  });

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const visibleNodes = nodes.filter((node) => {
      const matchesFamily =
        selectedFamilies.length === 0 || selectedFamilies.includes(node.family);
      const matchesYear =
        node.inceptionYear >= yearRange[0] && node.inceptionYear <= yearRange[1];
      const matchesQuery =
        !query ||
        node.name.toLowerCase().includes(query) ||
        node.developer.toLowerCase().includes(query) ||
        node.kernelName.toLowerCase().includes(query) ||
        node.inceptionYear.toString().includes(query);

      return matchesFamily && matchesYear && matchesQuery;
    });

    const layoutNodes = visibleNodes.map((node) => ({ ...node }));
    applyAdaptiveConstellationLayout(layoutNodes, links);

    const visibleNodeIds = new Set(layoutNodes.map((n) => n.id));

    const visibleLinks = links
      .filter((link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return visibleNodeIds.has(sourceId as string) && visibleNodeIds.has(targetId as string);
      })
      .map((link) => ({
        ...link,
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target,
      }));

    return {
      nodes: layoutNodes,
      links: visibleLinks,
    };
  }, [nodes, links, selectedFamilies, yearRange, searchQuery]);

  const filteredDataRef = useRef(filteredData);
  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  const { parentMap, childMap } = useMemo(() => {
    const pMap = new Map<string, { parentIds: Set<string>; links: LineageLink[] }>();
    const cMap = new Map<string, { childIds: Set<string>; links: LineageLink[] }>();

    filteredData.links.forEach((link) => {
      const sourceId = (typeof link.source === 'object' ? (link.source as any).id : link.source) as string;
      const targetId = (typeof link.target === 'object' ? (link.target as any).id : link.target) as string;

      if (!pMap.has(targetId)) pMap.set(targetId, { parentIds: new Set(), links: [] });
      pMap.get(targetId)!.parentIds.add(sourceId);
      pMap.get(targetId)!.links.push(link);

      if (!cMap.has(sourceId)) cMap.set(sourceId, { childIds: new Set(), links: [] });
      cMap.get(sourceId)!.childIds.add(targetId);
      cMap.get(sourceId)!.links.push(link);
    });

    return { parentMap: pMap, childMap: cMap };
  }, [filteredData.links]);

  const updateHighlights = useCallback(() => {
    const hNodes = highlightNodesRef.current;
    const hLinks = highlightLinksRef.current;
    const ancNodes = ancestorNodesRef.current;
    const descNodes = descendantNodesRef.current;
    const ancLinks = ancestorLinksRef.current;
    const descLinks = descendantLinksRef.current;
    const visitedA = visitedAncestorsRef.current;

    hNodes.clear();
    hLinks.clear();
    ancNodes.clear();
    descNodes.clear();
    ancLinks.clear();
    descLinks.clear();
    visitedA.clear();

    const activeNodes = [selectedNodeRef.current, hoverNodeRef.current].filter(Boolean) as OperatingSystemNode[];

    activeNodes.forEach((node) => {
      hNodes.add(node.id);

      const qAncestors = [node.id];
      visitedA.add(node.id);
      let headA = 0;
      while (headA < qAncestors.length && headA < 2000) {
        const curr = qAncestors[headA++];
        const entry = parentMap.get(curr);
        if (entry) {
          for (let i = 0; i < entry.links.length; i++) {
            hLinks.add(entry.links[i]);
            ancLinks.add(entry.links[i]);
          }
          entry.parentIds.forEach((pId) => {
            if (!visitedA.has(pId)) {
              visitedA.add(pId);
              hNodes.add(pId);
              ancNodes.add(pId);
              qAncestors.push(pId);
            }
          });
        }
      }

      const entryDescendants = childMap.get(node.id);
      if (entryDescendants) {
        for (let i = 0; i < entryDescendants.links.length; i++) {
          hLinks.add(entryDescendants.links[i]);
          descLinks.add(entryDescendants.links[i]);
        }
        entryDescendants.childIds.forEach((cId) => {
          hNodes.add(cId);
          descNodes.add(cId);
        });
      }
    });

    if (internalGraphRef.current) {
      if (activeNodes.length > 0) {
        internalGraphRef.current.autoPauseRedraw(false);
      } else {
        internalGraphRef.current.autoPauseRedraw(false);
        requestAnimationFrame(() => {
          if (!hoverNodeRef.current && !selectedNodeRef.current && internalGraphRef.current) {
            internalGraphRef.current.autoPauseRedraw(true);
          }
        });
      }
    }
  }, [parentMap, childMap]);

  const updateHighlightsRef = useRef(updateHighlights);
  useEffect(() => {
    updateHighlightsRef.current = updateHighlights;
  }, [updateHighlights]);

  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
    updateHighlights();
  }, [selectedNode, updateHighlights]);

  useEffect(() => {
    if (!containerRef.current) return;

    const createGraph = ForceGraph as unknown as () => (
      element: HTMLElement
    ) => ForceGraphGeneric<any, OperatingSystemNode, LineageLink>;

    const graph = createGraph()(containerRef.current)
      .backgroundColor('#000000')
      .nodeId('id')
      .linkSource('source')
      .linkTarget('target')
      .cooldownTicks(0)
      .autoPauseRedraw(true)
      .enableNodeDrag(false)
      .minZoom(deviceProfileRef.current.minZoom ?? 0.025)
      .maxZoom(2.8)
      .enablePointerInteraction(false)
      .linkCurvature(0)
      .linkVisibility((link: any) => {
        if (highlightLinksRef.current.has(link)) return true;
        const bounds = viewportBoundsRef.current;
        const s = link.source;
        const t = link.target;
        if (!s || !t || typeof s.x !== 'number' || typeof t.x !== 'number') return true;
        const minX = Math.min(s.x, t.x);
        const maxX = Math.max(s.x, t.x);
        const minY = Math.min(s.y, t.y);
        const maxY = Math.max(s.y, t.y);
        return maxX >= bounds.minX && minX <= bounds.maxX && maxY >= bounds.minY && minY <= bounds.maxY;
      })
      .linkDirectionalArrowLength((link: any) => {
        return highlightLinksRef.current.has(link) ? 4.5 : 0;
      })
      .linkDirectionalArrowRelPos(1)
      .linkDirectionalParticleSpeed(0.008)
      .linkDirectionalParticles((link: LineageLink) => {
        const hasFocus = Boolean(hoverNodeRef.current || selectedNodeRef.current);
        if (!hasFocus || !highlightLinksRef.current.has(link)) return 0;
        const scale = internalGraphRef.current?.zoom() || 1;
        if (scale < 0.12) return 0;
        const budget = governorRef.current.getProfile().particleBudget;
        if (budget === 0) return 0;
        const total = highlightLinksRef.current.size;
        if (total > 35) return 0;
        if (total > 15) return Math.min(1, budget);
        return budget;
      })
      .linkDirectionalParticleWidth((link: LineageLink) => {
        return highlightLinksRef.current.has(link) ? 2.5 : 1;
      })
      .linkDirectionalArrowColor((link: any) => {
        if (ancestorLinksRef.current.has(link)) return '#38bdf8';
        const total = highlightLinksRef.current.size;
        return total > 50 ? 'rgba(52, 211, 153, 0.45)' : '#34d399';
      })
      .linkColor((link: any) => {
        const isHighlight = highlightLinksRef.current.has(link);
        const hasFocus = Boolean(hoverNodeRef.current || selectedNodeRef.current);
        if (hasFocus) {
          if (isHighlight) {
            if (ancestorLinksRef.current.has(link)) {
              return 'rgba(56, 189, 248, 0.95)';
            }
            if (descendantLinksRef.current.has(link)) {
              return highlightLinksRef.current.size > 50 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(52, 211, 153, 0.95)';
            }
            return 'rgba(255, 255, 255, 0.95)';
          }
          return 'rgba(115, 115, 115, 0.07)';
        }
        const sourceNode = link.source as OperatingSystemNode;
        return (sourceNode && FAMILY_LINK_COLORS[sourceNode.family]) || 'rgba(115, 115, 115, 0.12)';
      })
      .linkWidth((link: any) => {
        if (!highlightLinksRef.current.has(link)) return 0.6;
        return highlightLinksRef.current.size > 50 ? 0.85 : 2.2;
      })
      .onZoom(() => {
        governorRef.current.resetOnZoom();
      })
      .onZoomEnd(() => {
        governorRef.current.resetOnZoom();
        if (isClampingRef.current) return;
        const center = graph.centerAt();
        if (!center) return;
        const MIN_X = -6200;
        const MAX_X = 6200;
        const MIN_Y = -6000;
        const MAX_Y = 6600;

        const clampedX = Math.max(MIN_X, Math.min(MAX_X, center.x));
        const clampedY = Math.max(MIN_Y, Math.min(MAX_Y, center.y));

        if (Math.abs(clampedX - center.x) > 100 || Math.abs(clampedY - center.y) > 100) {
          isClampingRef.current = true;
          graph.centerAt(clampedX, clampedY, 300);
          setTimeout(() => {
            isClampingRef.current = false;
          }, 350);
        }
      })
      .onRenderFramePre((ctx: CanvasRenderingContext2D, globalScale: number) => {
        renderStartTimeRef.current = performance.now();
        renderedLabelCellsRef.current.clear();

        if (containerRef.current) {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          const tl = graph.screen2GraphCoords(0, 0);
          const br = graph.screen2GraphCoords(w, h);
          if (tl && br) {
            const pad = 120 / Math.max(0.025, globalScale);
            viewportBoundsRef.current.minX = Math.min(tl.x, br.x) - pad;
            viewportBoundsRef.current.maxX = Math.max(tl.x, br.x) + pad;
            viewportBoundsRef.current.minY = Math.min(tl.y, br.y) - pad;
            viewportBoundsRef.current.maxY = Math.max(tl.y, br.y) + pad;
          }
        }

        ctx.save();
        ctx.strokeStyle = '#141414';
        ctx.lineWidth = Math.max(1, 2 / globalScale);
        ctx.strokeRect(-6400, -6200, 12800, 13000);

        const bounds = viewportBoundsRef.current;
        for (let i = 0; i < SECTOR_GLOBES.length; i++) {
          const g = SECTOR_GLOBES[i];
          if (
            g.x + g.radius * 1.2 < bounds.minX ||
            g.x - g.radius * 1.2 > bounds.maxX ||
            g.y + g.radius * 1.2 < bounds.minY ||
            g.y - g.radius * 1.2 > bounds.maxY
          ) {
            continue;
          }

          const pal = FAMILY_NEON_PALETTE[g.family] || { core: '#94a3b8' };
          const R = g.radius;

          const sphereGrad = ctx.createRadialGradient(
            g.x - R * 0.28,
            g.y - R * 0.32,
            R * 0.05,
            g.x,
            g.y,
            R * 1.06
          );
          sphereGrad.addColorStop(0, `${pal.core}14`);
          sphereGrad.addColorStop(0.55, `${pal.core}08`);
          sphereGrad.addColorStop(0.9, `${pal.core}02`);
          sphereGrad.addColorStop(1, 'rgba(0,0,0,0)');

          ctx.fillStyle = sphereGrad;
          ctx.beginPath();
          ctx.arc(g.x, g.y, R * 1.06, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = `${pal.core}22`;
          ctx.lineWidth = Math.max(1, 1.5 / globalScale);
          ctx.beginPath();
          ctx.arc(g.x, g.y, R * 1.06, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.save();
          ctx.beginPath();
          ctx.ellipse(g.x, g.y, R * 1.15, R * 0.35, -Math.PI / 10, 0, 2 * Math.PI);
          ctx.strokeStyle = `${pal.core}18`;
          ctx.lineWidth = Math.max(1, 1.2 / globalScale);
          ctx.stroke();
          ctx.restore();
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const labelFontSize = Math.max(18, 32 / globalScale);
        ctx.fillStyle = '#1c1c1c';
        ctx.font = `800 ${labelFontSize}px 'JetBrains Mono', monospace`;
        for (let i = 0; i < SECTOR_LABELS.length; i++) {
          const sec = SECTOR_LABELS[i];
          ctx.fillText(sec.text, sec.x, sec.y);
        }
        ctx.restore();
      })
      .nodeCanvasObject((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const osNode = node as OperatingSystemNode;
        const activeHover = hoverNodeRef.current;
        const activeSelected = selectedNodeRef.current;
        const isHovered = activeHover?.id === osNode.id;
        const isSelected = activeSelected?.id === osNode.id;
        const isFocused = isHovered || isSelected;
        const isNeighbor = highlightNodesRef.current.has(osNode.id);
        const hasActiveFocus = Boolean(activeHover || activeSelected);

        if (!isFocused && !isNeighbor) {
          const bounds = viewportBoundsRef.current;
          if (
            node.x < bounds.minX ||
            node.x > bounds.maxX ||
            node.y < bounds.minY ||
            node.y > bounds.maxY
          ) {
            return;
          }
        }

        const isAncestor = ancestorNodesRef.current.has(osNode.id);
        const isDescendant = descendantNodesRef.current.has(osNode.id);

        const zCoord = osNode.z || 0;
        const zRatio = Math.min(1, Math.max(0, zCoord / 800));

        let alpha = 1.0;
        if (hasActiveFocus && !isFocused && !isNeighbor) {
          alpha = 0.22;
          ctx.globalAlpha = 0.22;
        } else if (!isFocused && !isAncestor && !isDescendant) {
          alpha = 0.68 + 0.32 * zRatio;
          ctx.globalAlpha = alpha;
        }

        const profile = deviceProfileRef.current;
        const baseRadius = 5 + osNode.significance * 2.2;
        const minScreenRadius = isFocused
          ? profile.minScreenRadius.focused
          : isNeighbor
          ? profile.minScreenRadius.neighbor
          : profile.minScreenRadius.default;
        const screenRadius = Math.max(minScreenRadius, baseRadius * globalScale);
        const invScale = 1 / Math.max(0.025, globalScale);
        const drawRadius = screenRadius * invScale;

        if (!isFocused && !isAncestor && !isDescendant) {
          const sprite = getNodeSprite(osNode.family, osNode.significance);
          const drawSize = (drawRadius / sprite.radius) * sprite.size;
          ctx.drawImage(
            sprite.canvas,
            node.x - drawSize / 2,
            node.y - drawSize / 2,
            drawSize,
            drawSize
          );

          if (zRatio > 0.82 && globalScale >= 0.12) {
            ctx.beginPath();
            ctx.arc(node.x - drawRadius * 0.28, node.y - drawRadius * 0.28, Math.max(0.8, drawRadius * 0.25), 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fill();
          }
        } else {
          const palette = FAMILY_NEON_PALETTE[osNode.family] || {
            core: '#94a3b8',
            glow: '#cbd5e1',
            filament: 'rgba(148, 163, 184, 0.35)',
          };

          ctx.beginPath();
          ctx.arc(node.x, node.y, drawRadius * 1.8, 0, 2 * Math.PI);
          ctx.fillStyle = isFocused ? 'rgba(255, 255, 255, 0.35)' : palette.filament;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, drawRadius, 0, 2 * Math.PI);
          ctx.fillStyle = isFocused ? '#ffffff' : palette.core;
          ctx.fill();

          ctx.strokeStyle = isFocused ? '#ffffff' : '#000000';
          ctx.lineWidth = Math.max(1, 1.5 * invScale);
          ctx.stroke();

          if (isFocused) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, drawRadius + 4 * invScale, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = Math.max(1.5, 2 * invScale);
            ctx.stroke();

            if (governorRef.current.getProfile().enableAuraRings) {
              ctx.beginPath();
              ctx.arc(node.x, node.y, drawRadius + 7 * invScale, 0, 2 * Math.PI);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.lineWidth = Math.max(1, 1.5 * invScale);
              ctx.stroke();
            }
          } else if (isAncestor) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, drawRadius + 3.5 * invScale, 0, 2 * Math.PI);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = Math.max(1.5, 2 * invScale);
            ctx.stroke();
          } else if (isDescendant) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, drawRadius + 3.5 * invScale, 0, 2 * Math.PI);
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = Math.max(1.5, 2 * invScale);
            ctx.stroke();
          }
        }

        const isAnchor =
          osNode.significance >= 4 ||
          (osNode.sitelinks || 0) >= 28 ||
          osNode.id === 'debian' ||
          osNode.id === 'linux-kernel' ||
          osNode.id === 'ubuntu';

        const isNotable = osNode.significance >= 3 || (osNode.sitelinks || 0) >= 10;
        const isDenseSelection = descendantNodesRef.current.size > 35;

        let shouldShowLabel = false;
        if (isFocused || isAncestor || (!isDenseSelection && isNeighbor) || (isDenseSelection && isNeighbor && (isNotable || isAnchor))) {
          shouldShowLabel = true;
        } else if (globalScale >= 0.35) {
          shouldShowLabel = true;
        } else if (globalScale >= 0.18) {
          const stride = governorRef.current.getProfile().labelStride;
          const cellKey = ((Math.floor(node.x / 140) + 100000) * 10000) + (Math.floor(node.y / 45) + 100000);
          if (cellKey % stride === 0 && !renderedLabelCellsRef.current.has(cellKey)) {
            renderedLabelCellsRef.current.add(cellKey);
            shouldShowLabel = true;
          }
        } else if (isNotable && globalScale >= 0.12) {
          shouldShowLabel = true;
        } else if (isAnchor && globalScale >= 0.06) {
          shouldShowLabel = true;
        }

        if (shouldShowLabel) {
          const fontSize = Math.round(Math.max(11, Math.min(16, 12 / Math.sqrt(globalScale))));
          const weight = isFocused ? '700' : isAnchor ? '600' : '500';
          ctx.font = getCachedFont(weight, fontSize);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';

          const label = osNode.name;
          const textY = node.y + drawRadius + 4 * invScale;

          if (isFocused) {
            const textWidth = getCachedTextWidth(ctx, ctx.font, label);
            const padX = 8;
            const padY = 3;
            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(
              node.x - textWidth / 2 - padX,
              textY - 2,
              textWidth + padX * 2,
              fontSize + padY * 2,
              5
            );
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, node.x, textY);
          } else {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(label, node.x, textY);

            ctx.fillStyle = isAncestor
              ? '#7dd3fc'
              : isDescendant
              ? '#6ee7b7'
              : isNeighbor
              ? '#ffffff'
              : isAnchor
              ? '#f8fafc'
              : '#cbd5e1';
            ctx.fillText(label, node.x, textY);
          }
        }

        if (alpha !== 1.0) {
          ctx.globalAlpha = 1.0;
        }
      })
      .onRenderFramePost(() => {
        if (renderStartTimeRef.current > 0) {
          const duration = performance.now() - renderStartTimeRef.current;
          governorRef.current.recordFrame(duration, performance.now());
        }
      });

    internalGraphRef.current = graph;
    graphRef.current = graph;
    graph.graphData(filteredDataRef.current);
    spatialGridRef.current.rebuild(filteredDataRef.current.nodes);
    const isMobile = deviceProfileRef.current.tier === 'mobile';
    const initialZoom = isMobile ? 0.04 : 0.08;
    const initialNode = selectedNodeRef.current;
    if (initialNode && typeof initialNode.x === 'number' && typeof initialNode.y === 'number') {
      graph.centerAt(initialNode.x, initialNode.y);
      graph.zoom(1.6);
    } else {
      graph.centerAt(0, 300);
      graph.zoom(initialZoom);
    }

    const containerElem = containerRef.current;
    let pointerDownPos: { x: number; y: number } | null = null;
    let pointerType = 'mouse';
    let isDraggingCanvas = false;

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY };
      pointerType = event.pointerType || 'mouse';
      isDraggingCanvas = false;
    };

    let pendingMoveEvent: PointerEvent | null = null;
    let rafMoveId: number | null = null;

    const processPointerMove = () => {
      rafMoveId = null;
      if (!pendingMoveEvent || !internalGraphRef.current || !containerRef.current) return;
      const event = pendingMoveEvent;
      pendingMoveEvent = null;

      const target = event.target as HTMLElement | null;
      if (target && target.closest('aside, header, [role="dialog"]')) {
        if (hoverNodeRef.current) {
          hoverNodeRef.current = null;
          containerRef.current.style.cursor = 'default';
          updateHighlightsRef.current();
        }
        return;
      }

      if (pointerDownPos) {
        const moveDist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
        if (moveDist > (pointerType === 'touch' ? 12 : 5)) {
          isDraggingCanvas = true;
        }
      }

      const scale = internalGraphRef.current.zoom() || 1;
      if (scale < 0.16) {
        if (hoverNodeRef.current) {
          hoverNodeRef.current = null;
          containerRef.current.style.cursor = 'grab';
          updateHighlightsRef.current();
        }
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const coords = internalGraphRef.current.screen2GraphCoords(screenX, screenY);
      if (!coords) return;

      const hitBonus = pointerType === 'touch' ? deviceProfileRef.current.touchBonus : 20;
      const maxGraphDist = Math.max(16, (14 + hitBonus) / scale);
      const closest = spatialGridRef.current.findClosest(coords.x, coords.y, maxGraphDist);
      if (closest?.id !== hoverNodeRef.current?.id) {
        hoverNodeRef.current = closest;
        containerRef.current.style.cursor = closest ? 'pointer' : 'grab';
        updateHighlightsRef.current();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pendingMoveEvent = event;
      if (rafMoveId === null) {
        rafMoveId = requestAnimationFrame(processPointerMove);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!internalGraphRef.current || !containerRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('aside, header, [role="dialog"]')) return;

      if (isDraggingCanvas) {
        isDraggingCanvas = false;
        pointerDownPos = null;
        return;
      }

      if (pointerDownPos) {
        const threshold = pointerType === 'touch' ? 14 : 6;
        const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
        pointerDownPos = null;
        if (dist > threshold) return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const coords = internalGraphRef.current.screen2GraphCoords(screenX, screenY);
      if (coords) {
        const scale = Math.max(0.04, internalGraphRef.current.zoom() || 1);
        const hitBonus = pointerType === 'touch' ? deviceProfileRef.current.touchBonus : 24;
        const maxGraphDist = Math.max(18, (16 + hitBonus) / scale);
        const closest = spatialGridRef.current.findClosest(coords.x, coords.y, maxGraphDist);
        if (closest) {
          onSelectNodeRef.current(closest);
          return;
        }
      }
      onSelectNodeRef.current(null);
    };

    const handlePointerLeave = () => {
      pendingMoveEvent = null;
      if (rafMoveId !== null) {
        cancelAnimationFrame(rafMoveId);
        rafMoveId = null;
      }
      if (hoverNodeRef.current) {
        hoverNodeRef.current = null;
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }
        updateHighlightsRef.current();
      }
    };

    containerElem.addEventListener('pointerdown', handlePointerDown);
    containerElem.addEventListener('pointermove', handlePointerMove);
    containerElem.addEventListener('click', handleClick);
    containerElem.addEventListener('pointerleave', handlePointerLeave);

    const handleResize = () => {
      if (!containerRef.current || !internalGraphRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      deviceProfileRef.current = getDeviceProfile(w);
      internalGraphRef.current.width(w);
      internalGraphRef.current.height(h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerElem);
    window.addEventListener('resize', handleResize);
    handleResize();

    const unsubscribeGovernor = governorRef.current.subscribe(() => {
      if (internalGraphRef.current) {
        internalGraphRef.current.autoPauseRedraw(false);
        requestAnimationFrame(() => {
          if (!hoverNodeRef.current && !selectedNodeRef.current && internalGraphRef.current) {
            internalGraphRef.current.autoPauseRedraw(true);
          }
        });
      }
    });

    return () => {
      unsubscribeGovernor();
      if (rafMoveId !== null) {
        cancelAnimationFrame(rafMoveId);
      }
      containerElem.removeEventListener('pointerdown', handlePointerDown);
      containerElem.removeEventListener('pointermove', handlePointerMove);
      containerElem.removeEventListener('click', handleClick);
      containerElem.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      graph._destructor();
    };
  }, [graphRef]);

  useEffect(() => {
    if (!internalGraphRef.current) return;
    internalGraphRef.current.graphData(filteredData);
    spatialGridRef.current.rebuild(filteredData.nodes);
    updateHighlights();
  }, [filteredData, updateHighlights]);

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};
