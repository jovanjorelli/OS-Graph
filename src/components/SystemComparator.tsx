import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  Calendar,
  Cpu,
  Scale,
  Building2,
  GitFork,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  Compass,
} from 'lucide-react';
import type { OperatingSystemNode, LineageLink } from '../types/os';
import { FAMILY_NEON_PALETTE, FAMILY_NAMES, KERNEL_LABELS } from '../utils/colors';

interface SystemComparatorProps {
  sourceNode: OperatingSystemNode;
  allNodes: OperatingSystemNode[];
  allLinks: LineageLink[];
  onClose: () => void;
  onSelectNode: (node: OperatingSystemNode) => void;
}

import { findLowestCommonAncestor, type LcaAnalysisResult } from '../utils/lca';

const POPULAR_RIVALS: Record<string, string[]> = {
  debian: ['arch-linux', 'ubuntu', 'red-hat-linux', 'freebsd'],
  ubuntu: ['debian', 'fedora', 'linux-mint', 'arch-linux'],
  'arch-linux': ['debian', 'gentoo', 'manjaro', 'void-linux'],
  'linux-kernel': ['gnu', 'minix', 'freebsd', 'win-nt-31'],
  macos: ['win-11', 'freebsd', 'nextstep', 'ubuntu'],
  'win-11': ['macos', 'ubuntu', 'win-10', 'win-95'],
  'win-95': ['win-nt-40', 'mac-os-8', 'win-3', 'linux-kernel'],
  'win-nt-40': ['win-95', 'win-2000', 'solaris', 'linux-kernel'],
  freebsd: ['openbsd', 'netbsd', 'linux-kernel', 'macos'],
  android: ['ios', 'lineageos', 'tizen', 'linux-kernel'],
  'android-operating-system': ['ios', 'lineageos', 'tizen', 'linux-kernel'],
};

export const SystemComparator: React.FC<SystemComparatorProps> = ({
  sourceNode,
  allNodes,
  allLinks,
  onClose,
  onSelectNode,
}) => {
  const [currentSource, setCurrentSource] = useState<OperatingSystemNode>(sourceNode);
  const [searchQuery, setSearchQuery] = useState('');

  const nodeMap = useMemo(() => {
    return new Map<string, OperatingSystemNode>(allNodes.map((n) => [n.id, n]));
  }, [allNodes]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allLinks.forEach((link) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (!map.has(tId)) map.set(tId, []);
      map.get(tId)!.push(sId);
    });
    return map;
  }, [allLinks]);

  const [targetNode, setTargetNode] = useState<OperatingSystemNode | null>(() => {
    const rivals = POPULAR_RIVALS[sourceNode.id];
    if (rivals) {
      for (const id of rivals) {
        const match = allNodes.find((n) => n.id === id);
        if (match) return match;
      }
    }
    const parentLink = allLinks.find((l) => {
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return targetId === sourceNode.id;
    });
    if (parentLink) {
      const sourceId = typeof parentLink.source === 'object' ? parentLink.source.id : parentLink.source;
      const parent = allNodes.find((n) => n.id === sourceId);
      if (parent) return parent;
    }
    const inFamily = allNodes.find(
      (n) => n.family === sourceNode.family && n.id !== sourceNode.id && (n.sitelinks || 0) > 20
    );
    return inFamily || allNodes.find((n) => n.id !== sourceNode.id) || null;
  });

  const quickRivals = useMemo(() => {
    const curated = POPULAR_RIVALS[currentSource.id] || [];
    const matchedCurated = curated
      .map((id) => nodeMap.get(id))
      .filter((n): n is OperatingSystemNode => Boolean(n));

    if (matchedCurated.length >= 4) {
      return matchedCurated.slice(0, 4);
    }

    const parents = parentMap.get(currentSource.id) || [];
    const siblings: OperatingSystemNode[] = [];
    parents.forEach((pId) => {
      allLinks.forEach((l) => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        if (sId === pId && tId !== currentSource.id) {
          const sibling = nodeMap.get(tId);
          if (sibling && !siblings.some((s) => s.id === sibling.id)) {
            siblings.push(sibling);
          }
        }
      });
    });

    const combined = [...matchedCurated, ...siblings];
    if (combined.length < 4) {
      const popular = allNodes
        .filter((n) => n.id !== currentSource.id && (n.sitelinks || 0) > 25)
        .slice(0, 4 - combined.length);
      combined.push(...popular);
    }

    const deduped: OperatingSystemNode[] = [];
    combined.forEach((n) => {
      if (n.id !== currentSource.id && !deduped.some((d) => d.id === n.id)) {
        deduped.push(n);
      }
    });

    return deduped.slice(0, 4);
  }, [currentSource.id, nodeMap, parentMap, allLinks, allNodes]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allNodes
      .filter((n) => n.id !== currentSource.id && (n.name.toLowerCase().includes(q) || n.id.includes(q)))
      .slice(0, 8);
  }, [allNodes, currentSource.id, searchQuery]);

  const lcaAnalysis = useMemo<LcaAnalysisResult | null>(() => {
    if (!targetNode) return null;
    return findLowestCommonAncestor(currentSource.id, targetNode.id, parentMap, nodeMap);
  }, [currentSource.id, targetNode, parentMap, nodeMap]);

  const archAnalysis = useMemo(() => {
    if (!targetNode) return { common: [], sourceOnly: [], targetOnly: [], ratio: '0%' };
    const sSet = new Set(currentSource.architectures || []);
    const tSet = new Set(targetNode.architectures || []);

    const common: string[] = [];
    const sourceOnly: string[] = [];
    const targetOnly: string[] = [];

    sSet.forEach((a) => {
      if (tSet.has(a)) common.push(a);
      else sourceOnly.push(a);
    });

    tSet.forEach((a) => {
      if (!sSet.has(a)) targetOnly.push(a);
    });

    const totalUnique = new Set([...sSet, ...tSet]).size;
    const ratio = totalUnique > 0 ? `${Math.round((common.length / totalUnique) * 100)}%` : '0%';

    return { common, sourceOnly, targetOnly, ratio };
  }, [currentSource.architectures, targetNode]);

  const temporalDiff = useMemo(() => {
    if (!targetNode) return null;
    const diff = currentSource.inceptionYear - targetNode.inceptionYear;
    return {
      sameYear: diff === 0,
      diffYears: Math.abs(diff),
      earlier: diff < 0 ? currentSource : targetNode,
      later: diff > 0 ? currentSource : targetNode,
    };
  }, [currentSource, targetNode]);

  const handleSwap = () => {
    if (!targetNode) return;
    const previousSource = currentSource;
    setCurrentSource(targetNode);
    setTargetNode(previousSource);
  };

  const sourcePalette = FAMILY_NEON_PALETTE[currentSource.family];
  const targetPalette = targetNode ? FAMILY_NEON_PALETTE[targetNode.family] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-neutral-100">
        <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700">
              <ArrowRightLeft className="w-4 h-4 text-neutral-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono uppercase tracking-tight text-white">
                Architectural Comparator
              </h2>
              <p className="text-[11px] text-neutral-400">
                Cross-system comparative analysis and phylogenetic roots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Close comparator"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-3">
            <div className="relative">
              <div className="flex items-center px-3.5 py-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-inner focus-within:border-neutral-600 transition-colors">
                <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search an operating system to compare against..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-neutral-500 hover:text-white text-xs font-mono px-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-20 max-h-56 overflow-y-auto divide-y divide-neutral-800/60 font-mono text-xs">
                  {searchResults.map((result) => {
                    const pal = FAMILY_NEON_PALETTE[result.family];
                    return (
                      <button
                        key={result.id}
                        onClick={() => {
                          setTargetNode(result);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between w-full px-3.5 py-2 hover:bg-neutral-800/80 transition-colors text-left"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: pal.core }}
                          />
                          <span className="font-semibold text-white">{result.name}</span>
                          <span className="text-[10px] text-neutral-400">({result.inceptionYear})</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 uppercase">
                          {FAMILY_NAMES[result.family]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {quickRivals.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-500 mr-1 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-neutral-500" />
                  Rival Suggestions:
                </span>
                {quickRivals.map((rival) => {
                  const isCurrentTarget = targetNode?.id === rival.id;
                  const pal = FAMILY_NEON_PALETTE[rival.family];
                  return (
                    <button
                      key={rival.id}
                      onClick={() => setTargetNode(rival)}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                        isCurrentTarget
                          ? 'bg-neutral-800 border border-neutral-600 text-white font-semibold shadow-sm'
                          : 'bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 hover:bg-neutral-800/60'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pal.core }} />
                      <span>{rival.name}</span>
                      <span className="text-[10px] text-neutral-500 font-normal">({rival.inceptionYear})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {targetNode && targetPalette && (
            <>
              {temporalDiff && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-neutral-300">
                    <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>
                      {temporalDiff.sameYear ? (
                        <>Both systems originated in <strong className="text-white">{currentSource.inceptionYear}</strong> (Concurrent Generation)</>
                      ) : (
                        <>
                          <strong className="text-white">{temporalDiff.earlier.name}</strong> predates{' '}
                          <strong className="text-white">{temporalDiff.later.name}</strong> by{' '}
                          <strong className="text-amber-400">{temporalDiff.diffYears} {temporalDiff.diffYears === 1 ? 'year' : 'years'}</strong> ({temporalDiff.earlier.inceptionYear} vs {temporalDiff.later.inceptionYear})
                        </>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={handleSwap}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-[11px]"
                    title="Swap primary and comparative systems"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Swap Sides</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: sourcePalette.core }}
                      />
                      <span className="font-bold text-sm text-white font-mono">{currentSource.name}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wide px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {FAMILY_NAMES[currentSource.family]}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-600" />
                        Inception
                      </span>
                      <span className="text-white font-bold">{currentSource.inceptionYear}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-neutral-600" />
                        Kernel
                      </span>
                      <span className="text-neutral-200">{KERNEL_LABELS[currentSource.kernelType]}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-neutral-600" />
                        Developer
                      </span>
                      <span className="text-neutral-200 truncate max-w-[180px]" title={currentSource.developer}>
                        {currentSource.developer}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-neutral-600" />
                        License
                      </span>
                      <span className="text-neutral-200 truncate max-w-[180px]" title={currentSource.license}>
                        {currentSource.license}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectNode(currentSource);
                      onClose();
                    }}
                    className="mt-auto w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-medium transition-colors"
                  >
                    Locate in Graph
                  </button>
                </div>

                <div className="flex flex-col p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: targetPalette.core }}
                      />
                      <span className="font-bold text-sm text-white font-mono">{targetNode.name}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wide px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {FAMILY_NAMES[targetNode.family]}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-600" />
                        Inception
                      </span>
                      <span className="text-white font-bold">{targetNode.inceptionYear}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-neutral-600" />
                        Kernel
                      </span>
                      <span className="text-neutral-200">{KERNEL_LABELS[targetNode.kernelType]}</span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-neutral-800/40">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-neutral-600" />
                        Developer
                      </span>
                      <span className="text-neutral-200 truncate max-w-[180px]" title={targetNode.developer}>
                        {targetNode.developer}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Scale className="w-3 h-3 text-neutral-600" />
                        License
                      </span>
                      <span className="text-neutral-200 truncate max-w-[180px]" title={targetNode.license}>
                        {targetNode.license}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectNode(targetNode);
                      onClose();
                    }}
                    className="mt-auto w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-medium transition-colors"
                  >
                    Locate in Graph
                  </button>
                </div>
              </div>
            </>
          )}

          {targetNode && (
            <div className="space-y-4 pt-2 border-t border-neutral-800/80 font-mono text-xs">
              <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-neutral-400 text-[11px] uppercase tracking-wider">
                    <GitFork className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Phylogenetic Kinship & Convergence Path</span>
                  </div>
                  {lcaAnalysis && (
                    <span className="text-[10px] text-neutral-500">
                      Separation: {lcaAnalysis.sourceDistance + lcaAnalysis.targetDistance} steps
                    </span>
                  )}
                </div>

                {lcaAnalysis ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-950/80 border border-neutral-800/90 rounded-lg text-xs leading-relaxed text-neutral-300">
                      {lcaAnalysis.lcaNode.id === currentSource.id ? (
                        <span>
                          <strong className="text-white">{currentSource.name}</strong> is a direct ancestor of{' '}
                          <strong className="text-white">{targetNode.name}</strong> ({lcaAnalysis.targetDistance} generation{lcaAnalysis.targetDistance === 1 ? '' : 's'} down the lineage).
                        </span>
                      ) : lcaAnalysis.lcaNode.id === targetNode.id ? (
                        <span>
                          <strong className="text-white">{targetNode.name}</strong> is a direct ancestor of{' '}
                          <strong className="text-white">{currentSource.name}</strong> ({lcaAnalysis.sourceDistance} generation{lcaAnalysis.sourceDistance === 1 ? '' : 's'} down the lineage).
                        </span>
                      ) : (
                        <span>
                          Lowest Common Ancestor (LCA):{' '}
                          <button
                            onClick={() => {
                              onSelectNode(lcaAnalysis.lcaNode);
                              onClose();
                            }}
                            className="font-bold text-white bg-neutral-800 hover:bg-neutral-700 px-2 py-0.5 rounded transition-colors"
                          >
                            {lcaAnalysis.lcaNode.name} ({lcaAnalysis.lcaNode.inceptionYear})
                          </button>
                          . Both systems trace their root phylogenetic heritage back to this milestone.
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                          {currentSource.name} Trace to LCA ({lcaAnalysis.sourceDistance} steps)
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[11px]">
                          {lcaAnalysis.pathSource.map((node, idx) => (
                            <React.Fragment key={node.id}>
                              {idx > 0 && <span className="text-neutral-600">→</span>}
                              <button
                                onClick={() => {
                                  onSelectNode(node);
                                  onClose();
                                }}
                                className={`px-2 py-0.5 rounded border transition-colors ${
                                  node.id === lcaAnalysis.lcaNode.id
                                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 font-semibold'
                                    : node.id === currentSource.id
                                    ? 'bg-neutral-800 border-neutral-700 text-white font-semibold'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                                }`}
                              >
                                {node.name}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                          {targetNode.name} Trace to LCA ({lcaAnalysis.targetDistance} steps)
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[11px]">
                          {lcaAnalysis.pathTarget.map((node, idx) => (
                            <React.Fragment key={node.id}>
                              {idx > 0 && <span className="text-neutral-600">→</span>}
                              <button
                                onClick={() => {
                                  onSelectNode(node);
                                  onClose();
                                }}
                                className={`px-2 py-0.5 rounded border transition-colors ${
                                  node.id === lcaAnalysis.lcaNode.id
                                    ? 'bg-amber-950/40 border-amber-800/60 text-amber-300 font-semibold'
                                    : node.id === targetNode.id
                                    ? 'bg-neutral-800 border-neutral-700 text-white font-semibold'
                                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                                }`}
                              >
                                {node.name}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-lg text-xs text-neutral-400">
                    Independent Lineages. No direct shared phylogenetic ancestor recorded in the system graph.
                  </div>
                )}
              </div>

              <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-3">
                <div className="flex items-center space-x-2 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Architectural Spec Matrix</span>
                </div>

                <div className="divide-y divide-neutral-800/60 border border-neutral-800/80 rounded-lg overflow-hidden bg-neutral-950/40">
                  <div className="grid grid-cols-3 p-2.5 text-[11px] bg-neutral-900/40 font-semibold text-neutral-400">
                    <div>Metric</div>
                    <div>{currentSource.name}</div>
                    <div>{targetNode.name}</div>
                  </div>

                  <div className="grid grid-cols-3 p-2.5 text-xs items-center">
                    <div className="text-neutral-500">Kernel Model</div>
                    <div className="text-neutral-200">{KERNEL_LABELS[currentSource.kernelType]}</div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-neutral-200">{KERNEL_LABELS[targetNode.kernelType]}</span>
                      {currentSource.kernelType === targetNode.kernelType ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 p-2.5 text-xs items-center">
                    <div className="text-neutral-500">Phylogenetic Family</div>
                    <div className="text-neutral-200">{FAMILY_NAMES[currentSource.family]}</div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-neutral-200">{FAMILY_NAMES[targetNode.family]}</span>
                      {currentSource.family === targetNode.family ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 p-2.5 text-xs items-center">
                    <div className="text-neutral-500">License Model</div>
                    <div className="text-neutral-300 truncate pr-2" title={currentSource.license}>{currentSource.license}</div>
                    <div className="text-neutral-300 truncate pr-2" title={targetNode.license}>{targetNode.license}</div>
                  </div>

                  <div className="grid grid-cols-3 p-2.5 text-xs items-center">
                    <div className="text-neutral-500">Wikipedia Sitelinks</div>
                    <div className="text-neutral-300">{currentSource.sitelinks || 0} links</div>
                    <div className="text-neutral-300">{targetNode.sitelinks || 0} links</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Target CPU Architecture Overlap</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]">
                    {archAnalysis.ratio} Overlap ({archAnalysis.common.length} Shared)
                  </span>
                </div>

                {archAnalysis.common.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-emerald-400 uppercase font-semibold">Shared by Both</div>
                    <div className="flex flex-wrap gap-1">
                      {archAnalysis.common.map((arch) => (
                        <span
                          key={arch}
                          className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 rounded text-[11px]"
                        >
                          {arch}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {archAnalysis.sourceOnly.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-400 uppercase">Only {currentSource.name}</div>
                      <div className="flex flex-wrap gap-1">
                        {archAnalysis.sourceOnly.map((arch) => (
                          <span
                            key={arch}
                            className="px-1.5 py-0.5 bg-neutral-800/60 border border-neutral-700/60 text-neutral-300 rounded text-[10px]"
                          >
                            {arch}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {archAnalysis.targetOnly.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-neutral-400 uppercase">Only {targetNode.name}</div>
                      <div className="flex flex-wrap gap-1">
                        {archAnalysis.targetOnly.map((arch) => (
                          <span
                            key={arch}
                            className="px-1.5 py-0.5 bg-neutral-800/60 border border-neutral-700/60 text-neutral-300 rounded text-[10px]"
                          >
                            {arch}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
