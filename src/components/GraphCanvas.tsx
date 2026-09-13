import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph from 'force-graph';
import type { ForceGraphGeneric } from 'force-graph';
import type { OperatingSystemNode, LineageLink, OperatingSystemFamily } from '../types/os';
import { FAMILY_NEON_PALETTE } from '../utils/colors';
import { SpatialNodeGrid } from '../utils/spatial';

interface GraphCanvasProps {
  nodes: OperatingSystemNode[];
  links: LineageLink[];
  selectedNode: OperatingSystemNode | null;
  onSelectNode: (node: OperatingSystemNode | null) => void;
  selectedFamilies: OperatingSystemFamily[];
  yearRange: [number, number];
  significanceTier?: number;
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
  const size = Math.ceil((haloRadius + padding) * 2);
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
  { text: 'UNIX', x: 95, y: -7950 },
  { text: 'APPLE & MACOS', x: -7700, y: -3300 },
  { text: 'BSD', x: 7950, y: -3250 },
  { text: 'WINDOWS & DOS', x: -7960, y: 3200 },
  { text: 'LINUX', x: 8550, y: 1050 },
  { text: 'RESEARCH & INDEPENDENT', x: -25, y: 5900 },
];

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes,
  links,
  selectedNode,
  onSelectNode,
  selectedFamilies,
  yearRange,
  significanceTier,
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
  const isClampingRef = useRef(false);
  const spatialGridRef = useRef(new SpatialNodeGrid(350));
  const renderedLabelCellsRef = useRef<Set<string>>(new Set());

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
      const matchesTier =
        significanceTier === undefined ||
        significanceTier === 0 ||
        (node.sitelinks || 0) >= significanceTier;
      const matchesQuery =
        !query ||
        node.name.toLowerCase().includes(query) ||
        node.developer.toLowerCase().includes(query) ||
        node.kernelName.toLowerCase().includes(query) ||
        node.inceptionYear.toString().includes(query);

      return matchesFamily && matchesYear && matchesTier && matchesQuery;
    });

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

    const visibleLinks = links.filter((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return visibleNodeIds.has(sourceId as string) && visibleNodeIds.has(targetId as string);
    });

    return {
      nodes: visibleNodes,
      links: visibleLinks,
    };
  }, [nodes, links, selectedFamilies, yearRange, significanceTier, searchQuery]);

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
    const hNodes = new Set<string>();
    const hLinks = new Set<LineageLink>();
    const ancNodes = new Set<string>();
    const descNodes = new Set<string>();
    const ancLinks = new Set<LineageLink>();
    const descLinks = new Set<LineageLink>();

    const activeNodes = [selectedNodeRef.current, hoverNodeRef.current].filter(Boolean) as OperatingSystemNode[];

    activeNodes.forEach((node) => {
      hNodes.add(node.id);

      const qAncestors = [node.id];
      const visitedA = new Set<string>([node.id]);
      let headA = 0;
      while (headA < qAncestors.length) {
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

    highlightNodesRef.current = hNodes;
    highlightLinksRef.current = hLinks;
    ancestorNodesRef.current = ancNodes;
    descendantNodesRef.current = descNodes;
    ancestorLinksRef.current = ancLinks;
    descendantLinksRef.current = descLinks;
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
      .autoPauseRedraw(false)
      .enableNodeDrag(false)
      .minZoom(0.08)
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
        const total = highlightLinksRef.current.size;
        if (total > 35) return 0;
        if (total > 15) return 1;
        return 2;
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
          return 'rgba(255, 255, 255, 0.015)';
        }
        const sourceNode = link.source as OperatingSystemNode;
        return (sourceNode && FAMILY_LINK_COLORS[sourceNode.family]) || 'rgba(115, 115, 115, 0.12)';
      })
      .linkWidth((link: any) => {
        if (!highlightLinksRef.current.has(link)) return 0.6;
        return highlightLinksRef.current.size > 50 ? 0.85 : 2.2;
      })
      .onZoomEnd(() => {
        if (isClampingRef.current) return;
        const center = graph.centerAt();
        if (!center) return;
        const MIN_X = -10500;
        const MAX_X = 10500;
        const MIN_Y = -9200;
        const MAX_Y = 9800;

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
        renderedLabelCellsRef.current.clear();

        if (containerRef.current) {
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          const tl = graph.screen2GraphCoords(0, 0);
          const br = graph.screen2GraphCoords(w, h);
          if (tl && br) {
            const pad = 120 / Math.max(0.05, globalScale);
            viewportBoundsRef.current.minX = Math.min(tl.x, br.x) - pad;
            viewportBoundsRef.current.maxX = Math.max(tl.x, br.x) + pad;
            viewportBoundsRef.current.minY = Math.min(tl.y, br.y) - pad;
            viewportBoundsRef.current.maxY = Math.max(tl.y, br.y) + pad;
          }
        }

        ctx.save();
        ctx.strokeStyle = '#141414';
        ctx.lineWidth = Math.max(1, 2 / globalScale);
        ctx.strokeRect(-10600, -9300, 21200, 19200);

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

        let alpha = 1.0;
        if (hasActiveFocus && !isFocused && !isNeighbor) {
          alpha = 0.04;
          ctx.globalAlpha = 0.04;
        }

        const baseRadius = 5 + osNode.significance * 2.2;
        const minScreenRadius = isFocused ? 7.5 : isNeighbor ? 5.5 : 3.5;
        const screenRadius = Math.max(minScreenRadius, baseRadius * globalScale);
        const invScale = 1 / Math.max(0.05, globalScale);
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

            ctx.beginPath();
            ctx.arc(node.x, node.y, drawRadius + 7 * invScale, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = Math.max(1, 1.5 * invScale);
            ctx.stroke();
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
        } else if (isAnchor && globalScale >= 0.2) {
          shouldShowLabel = true;
        } else if (isNotable && globalScale >= 0.45) {
          shouldShowLabel = true;
        } else if (globalScale >= 1.35) {
          const cellKey = `${Math.floor(node.x / 140)}:${Math.floor(node.y / 45)}`;
          if (!renderedLabelCellsRef.current.has(cellKey)) {
            renderedLabelCellsRef.current.add(cellKey);
            shouldShowLabel = true;
          }
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
            const metrics = ctx.measureText(label);
            const textWidth = metrics.width;
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
      });

    internalGraphRef.current = graph;
    graphRef.current = graph;
    graph.graphData(filteredDataRef.current);
    spatialGridRef.current.rebuild(filteredDataRef.current.nodes);
    graph.centerAt(0, 200);
    graph.zoom(0.08);

    const containerElem = containerRef.current;
    let pointerDownPos: { x: number; y: number } | null = null;
    let pointerType = 'mouse';

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY };
      pointerType = event.pointerType || 'mouse';
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!internalGraphRef.current || !containerRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('aside, header, [role="dialog"]')) {
        if (hoverNodeRef.current) {
          hoverNodeRef.current = null;
          containerRef.current.style.cursor = 'default';
          updateHighlightsRef.current();
        }
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const coords = internalGraphRef.current.screen2GraphCoords(screenX, screenY);
      if (!coords) return;
      const scale = Math.max(0.05, internalGraphRef.current.zoom() || 1);
      const maxGraphDist = 22 / scale;
      const closest = spatialGridRef.current.findClosest(coords.x, coords.y, maxGraphDist);
      if (closest?.id !== hoverNodeRef.current?.id) {
        hoverNodeRef.current = closest;
        containerRef.current.style.cursor = closest ? 'pointer' : 'grab';
        updateHighlightsRef.current();
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!internalGraphRef.current || !containerRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('aside, header, [role="dialog"]')) return;

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
        const scale = Math.max(0.05, internalGraphRef.current.zoom() || 1);
        const touchBonus = pointerType === 'touch' ? 36 : 26;
        const maxGraphDist = touchBonus / scale;
        const closest = spatialGridRef.current.findClosest(coords.x, coords.y, maxGraphDist);
        onSelectNodeRef.current(closest);
        return;
      }
      onSelectNodeRef.current(null);
    };

    const handlePointerLeave = () => {
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
      internalGraphRef.current.width(containerRef.current.clientWidth);
      internalGraphRef.current.height(containerRef.current.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerElem);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
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
