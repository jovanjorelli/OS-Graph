import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  ExternalLink,
  Cpu,
  Calendar,
  Building2,
  Scale,
  GitFork,
  ArrowUpRight,
  Loader2,
  Layers,
  BookOpen,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import type { OperatingSystemNode, LineageLink, WikipediaSummary } from '../types/os';
import {
  FAMILY_NEON_PALETTE,
  FAMILY_NAMES,
  KERNEL_LABELS,
  getReleaseEra,
} from '../utils/colors';
import { fetchWikipediaSummary } from '../services/wikipedia';

interface InspectorDrawerProps {
  selectedNode: OperatingSystemNode;
  allNodes: OperatingSystemNode[];
  allLinks: LineageLink[];
  onClose: () => void;
  onSelectNode: (node: OperatingSystemNode) => void;
  onOpenComparator?: (node: OperatingSystemNode) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  selectedNode,
  allNodes,
  allLinks,
  onClose,
  onSelectNode,
  onOpenComparator,
}) => {
  const [wikiSummary, setWikiSummary] = useState<WikipediaSummary | null>(null);
  const [isLoadingWiki, setIsLoadingWiki] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetchWikipediaSummary(
      selectedNode.wikipediaTitle,
      selectedNode.name,
      controller.signal
    )
      .then((summary) => {
        if (!controller.signal.aborted) {
          setWikiSummary(summary);
          setIsLoadingWiki(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsLoadingWiki(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedNode.wikipediaTitle, selectedNode.name]);

  const nodeMap = useMemo(() => {
    return new Map<string, OperatingSystemNode>(allNodes.map((n) => [n.id, n]));
  }, [allNodes]);

  const { parents, children } = useMemo(() => {
    if (!selectedNode) return { parents: [], children: [] };

    const parentList: OperatingSystemNode[] = [];
    const childList: OperatingSystemNode[] = [];
    const seenParentIds = new Set<string>();
    const seenChildIds = new Set<string>();

    allLinks.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (targetId === selectedNode.id) {
        const parentNode = nodeMap.get(sourceId as string);
        if (parentNode && !seenParentIds.has(parentNode.id)) {
          seenParentIds.add(parentNode.id);
          parentList.push(parentNode);
        }
      }

      if (sourceId === selectedNode.id) {
        const childNode = nodeMap.get(targetId as string);
        if (childNode && !seenChildIds.has(childNode.id)) {
          seenChildIds.add(childNode.id);
          childList.push(childNode);
        }
      }
    });

    return { parents: parentList, children: childList };
  }, [selectedNode, nodeMap, allLinks]);

  const palette = FAMILY_NEON_PALETTE[selectedNode.family] || {
    core: '#94a3b8',
    glow: '#cbd5e1',
    filament: 'rgba(148, 163, 184, 0.35)',
  };

  return (
    <aside className="fixed top-16 right-4 bottom-4 z-40 w-full sm:w-[440px] max-w-[calc(100vw-2rem)] bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-3 duration-200">
      <div
        className="h-1 w-full shrink-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${palette.core}, transparent)`,
        }}
      />

      <div className="flex items-center justify-between p-4 border-b border-neutral-800/80">
        <div className="flex items-center space-x-3 min-w-0 pr-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{
              backgroundColor: palette.core,
              boxShadow: `0 0 10px ${palette.core}80`,
            }}
          />
          <h2 className="text-base font-bold text-white tracking-tight truncate">
            {selectedNode.name}
          </h2>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          {onOpenComparator && (
            <button
              onClick={() => onOpenComparator(selectedNode)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all active:scale-95 shadow-sm"
              title="Compare with another OS"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>Compare</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors focus:outline-none active:scale-95 shrink-0"
            aria-label="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-md font-mono font-medium bg-neutral-900 text-neutral-200 border border-neutral-800">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: palette.core }}
            />
            <span>{FAMILY_NAMES[selectedNode.family]}</span>
          </span>

          <span className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-md font-mono bg-neutral-900 text-neutral-300 border border-neutral-800">
            <Calendar className="w-3 h-3 text-neutral-500" />
            <span>{selectedNode.inceptionYear}</span>
          </span>

          {selectedNode.significance > 0 && (
            <span className="text-[11px] px-2 py-1 rounded-md font-mono bg-neutral-900 text-neutral-400 border border-neutral-800">
              Tier {selectedNode.significance}
            </span>
          )}
        </div>

        {selectedNode.description && (
          <div
            className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed"
            style={{ borderLeftWidth: '3px', borderLeftColor: palette.core }}
          >
            {selectedNode.description}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-3 space-y-1 hover:border-neutral-700/80 transition-colors">
            <div className="flex items-center space-x-1.5 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
              <Layers className="w-3 h-3 text-neutral-500" />
              <span>Kernel</span>
            </div>
            <div className="font-semibold text-neutral-100 truncate text-xs">
              {KERNEL_LABELS[selectedNode.kernelType]}
            </div>
            <div
              className="text-[11px] text-neutral-400 truncate font-mono"
              title={selectedNode.kernelName}
            >
              {selectedNode.kernelName}
            </div>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-3 space-y-1 hover:border-neutral-700/80 transition-colors">
            <div className="flex items-center space-x-1.5 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
              <Calendar className="w-3 h-3 text-neutral-500" />
              <span>Inception</span>
            </div>
            <div className="font-semibold text-neutral-100 text-xs">
              {selectedNode.inceptionYear}
            </div>
            <div className="text-[11px] text-neutral-400 truncate font-mono">
              {getReleaseEra(selectedNode.inceptionYear)}
            </div>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-3 space-y-1 hover:border-neutral-700/80 transition-colors">
            <div className="flex items-center space-x-1.5 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
              <Building2 className="w-3 h-3 text-neutral-500" />
              <span>Developer</span>
            </div>
            <div
              className="font-semibold text-neutral-100 truncate text-xs"
              title={selectedNode.developer}
            >
              {selectedNode.developer}
            </div>
            <div className="text-[11px] text-neutral-500 truncate font-mono">
              Primary Author
            </div>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-3 space-y-1 hover:border-neutral-700/80 transition-colors">
            <div className="flex items-center space-x-1.5 text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
              <Scale className="w-3 h-3 text-neutral-500" />
              <span>License</span>
            </div>
            <div
              className="font-semibold text-neutral-100 truncate text-xs"
              title={selectedNode.license}
            >
              {selectedNode.license}
            </div>
            <div className="text-[11px] text-neutral-500 truncate font-mono">
              Distribution Terms
            </div>
          </div>
        </div>

        {selectedNode.architectures.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-[10px] uppercase font-mono tracking-wider text-neutral-400">
              <Cpu className="w-3 h-3 text-neutral-500" />
              <span>Target Architectures</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedNode.architectures.map((arch) => (
                <span
                  key={arch}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors"
                >
                  {arch}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-neutral-800/80">
          <div className="flex items-center space-x-1.5 text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            <GitFork className="w-3 h-3 text-neutral-500" />
            <span>Lineage Relationships</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="text-[10px] font-mono text-neutral-400 mb-1.5 uppercase">
                Upstream Architecture
              </div>
              {parents.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {parents.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectNode(p)}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 text-xs font-medium transition-all active:scale-95"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            FAMILY_NEON_PALETTE[p.family]?.core || '#a3a3a3',
                        }}
                      />
                      <span>{p.name}</span>
                      <ArrowUpRight className="w-3 h-3 text-neutral-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-neutral-500 font-mono py-1">
                  <Sparkles className="w-3 h-3 text-neutral-600" />
                  <span>Independent Genesis / Root Architecture</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-neutral-400 uppercase">
                  Downstream Derivatives
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  {children.length} total
                </span>
              </div>
              {children.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {children.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onSelectNode(c)}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 text-xs font-medium transition-all active:scale-95"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            FAMILY_NEON_PALETTE[c.family]?.core || '#a3a3a3',
                        }}
                      />
                      <span>{c.name}</span>
                      <ArrowUpRight className="w-3 h-3 text-neutral-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-neutral-500 font-mono py-1">
                  Terminal Distribution (No Derivatives)
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-3 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 flex items-center space-x-1.5">
              <BookOpen className="w-3 h-3 text-neutral-500" />
              <span>Wikipedia Dossier</span>
            </span>
            {isLoadingWiki && (
              <span className="flex items-center space-x-1 text-[10px] font-mono text-neutral-500">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                <span>Syncing</span>
              </span>
            )}
          </div>

          <div className="space-y-3 bg-neutral-900/40 rounded-xl p-3.5 border border-neutral-800/70">
            {wikiSummary?.thumbnailUrl && (
              <div className="flex justify-center p-2 bg-black rounded-lg border border-neutral-850">
                <img
                  src={wikiSummary.thumbnailUrl}
                  alt={selectedNode.name}
                  className="max-h-28 object-contain rounded"
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-xs text-neutral-300 leading-relaxed">
              {wikiSummary?.extract || selectedNode.description}
            </p>
            <div>
              <a
                href={
                  wikiSummary?.pageUrl ||
                  `https://en.wikipedia.org/wiki/${encodeURIComponent(
                    selectedNode.wikipediaTitle || selectedNode.name
                  )}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs text-neutral-200 hover:text-white font-medium group transition-colors"
              >
                <span>View Wikipedia Dossier</span>
                <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-white transition-colors" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
