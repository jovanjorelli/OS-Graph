import { useState, useRef, useMemo, useCallback } from 'react';
import { SlidersHorizontal, Globe } from 'lucide-react';
import type { ForceGraphGeneric } from 'force-graph';
import fullDataset from './data/operatingSystemsFull.json';
import type { OperatingSystemNode, LineageLink, OperatingSystemFamily } from './types/os';
import { GraphCanvas } from './components/GraphCanvas';
import { InspectorDrawer } from './components/InspectorDrawer';
import { SearchBar } from './components/SearchBar';
import { FilterToolbar } from './components/FilterToolbar';
import { SystemComparator } from './components/SystemComparator';
import { FAMILY_NEON_PALETTE, FAMILY_NAMES } from './utils/colors';

const SECTOR_COORDINATES: Record<string, { x: number; y: number; zoom: number }> = {
  all: { x: 0, y: 200, zoom: 0.08 },
  unix: { x: 95, y: -7190, zoom: 0.85 },
  apple: { x: -7700, y: -2500, zoom: 0.85 },
  bsd: { x: 7950, y: -2600, zoom: 0.95 },
  windows: { x: -7960, y: 4050, zoom: 0.8 },
  linux: { x: 8550, y: 2950, zoom: 0.38 },
  independent: { x: -25, y: 7520, zoom: 0.38 },
};

export function App() {
  const [selectedNode, setSelectedNode] = useState<OperatingSystemNode | null>(null);
  const [selectedFamilies, setSelectedFamilies] = useState<OperatingSystemFamily[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1969, 2026]);
  const [significanceTier, setSignificanceTier] = useState<number>(10);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeSector, setActiveSector] = useState<string>('all');
  const [comparatorSourceNode, setComparatorSourceNode] = useState<OperatingSystemNode | null>(null);

  const graphRef = useRef<ForceGraphGeneric<any, OperatingSystemNode, LineageLink> | null>(null);

  const allNodes = useMemo(() => fullDataset.nodes as OperatingSystemNode[], []);
  const allLinks = useMemo(() => fullDataset.links as LineageLink[], []);

  const visibleCount = useMemo(() => {
    return allNodes.filter((node) => {
      const matchesFamily =
        selectedFamilies.length === 0 || selectedFamilies.includes(node.family);
      const matchesYear =
        node.inceptionYear >= yearRange[0] &&
        node.inceptionYear <= yearRange[1];
      const matchesTier =
        significanceTier === 0 || (node.sitelinks || 0) >= significanceTier;
      return matchesFamily && matchesYear && matchesTier;
    }).length;
  }, [allNodes, selectedFamilies, yearRange, significanceTier]);

  const handleToggleFamily = useCallback((family: OperatingSystemFamily) => {
    setSelectedFamilies((prev) =>
      prev.includes(family) ? prev.filter((f) => f !== family) : [...prev, family]
    );
  }, []);

  const handleSelectNode = useCallback((node: OperatingSystemNode | null) => {
    setSelectedNode(node);
    if (node) {
      setIsFilterOpen(false);
      if (graphRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
        graphRef.current.centerAt(node.x, node.y, 450);
        graphRef.current.zoom(1.8, 450);
      }
    }
  }, []);

  const handleToggleFilter = useCallback(() => {
    setIsFilterOpen((prev) => {
      const next = !prev;
      if (next) {
        setSelectedNode(null);
      }
      return next;
    });
  }, []);

  const handleJumpToSector = useCallback((sectorKey: string) => {
    setActiveSector(sectorKey);
    const coords = SECTOR_COORDINATES[sectorKey];
    if (coords && graphRef.current) {
      graphRef.current.centerAt(coords.x, coords.y, 450);
      graphRef.current.zoom(coords.zoom, 450);
    }
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black text-neutral-100 overflow-hidden font-sans select-none">
      <header className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 z-30 pointer-events-none flex flex-col gap-1.5 sm:gap-2">
        <div className="flex items-center justify-between w-full gap-1.5 sm:hidden">
          <div className="flex items-center space-x-1.5 pointer-events-auto bg-neutral-950/90 backdrop-blur-md border border-neutral-800/90 px-2 py-1 rounded-lg shadow-xl shrink-0">
            <span className="text-[11px] font-bold tracking-tight text-white font-mono uppercase">
              OS Graph
            </span>
            <span className="text-neutral-700">|</span>
            <div className="flex items-center space-x-1 text-[10px] font-mono text-neutral-400">
              <Globe className="w-2.5 h-2.5 text-neutral-500" />
              <span>{allNodes.length.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1 pointer-events-auto shrink-0">
            <button
              onClick={handleToggleFilter}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all active:scale-95 shadow-lg ${
                isFilterOpen || selectedFamilies.length > 0
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-neutral-950/90 backdrop-blur-md border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filters</span>
              {selectedFamilies.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
        </div>

        <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth p-0.5 bg-neutral-950/90 backdrop-blur-md rounded-lg border border-neutral-800/80 shadow-xl text-[10px] font-mono pointer-events-auto w-full">
          <button
            onClick={() => handleJumpToSector('all')}
            className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
              activeSector === 'all'
                ? 'bg-neutral-800 text-white font-medium'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All
          </button>
          {(['unix', 'apple', 'bsd', 'windows', 'linux', 'independent'] as const).map((family) => {
            const palette = FAMILY_NEON_PALETTE[family];
            const isActive = activeSector === family;
            return (
              <button
                key={family}
                onClick={() => handleJumpToSector(family)}
                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition-colors whitespace-nowrap capitalize shrink-0 ${
                  isActive
                    ? 'bg-neutral-800 text-white font-medium'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette.core }}
                />
                <span>{FAMILY_NAMES[family].split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center w-full gap-2">
          <div className="flex items-center space-x-2 pointer-events-auto bg-black border border-neutral-800 px-3 py-1.5 rounded-lg shadow-xl shrink-0 justify-self-start">
            <span className="text-xs font-bold tracking-tight text-white font-mono uppercase">
              OS Graph
            </span>
            <span className="text-neutral-800">|</span>
            <div className="flex items-center space-x-1 text-[11px] font-mono text-neutral-400">
              <Globe className="w-3 h-3 text-neutral-500" />
              <span>{allNodes.length.toLocaleString()} Systems</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 bg-black rounded-lg border border-neutral-800 shadow-xl text-xs font-mono pointer-events-auto justify-self-center">
            <button
              onClick={() => handleJumpToSector('all')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                activeSector === 'all'
                  ? 'bg-neutral-800 text-white font-medium'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All
            </button>
            {(['unix', 'apple', 'bsd', 'windows', 'linux', 'independent'] as const).map((family) => {
              const palette = FAMILY_NEON_PALETTE[family];
              const isActive = activeSector === family;
              return (
                <button
                  key={family}
                  onClick={() => handleJumpToSector(family)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap capitalize ${
                    isActive
                      ? 'bg-neutral-800 text-white font-medium'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: palette.core }}
                  />
                  <span className="hidden lg:inline">{FAMILY_NAMES[family]}</span>
                  <span className="lg:hidden">{FAMILY_NAMES[family].split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-1.5 pointer-events-auto shrink-0 justify-self-end">
            <button
              onClick={handleToggleFilter}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors shadow-lg ${
                isFilterOpen || selectedFamilies.length > 0
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filters</span>
              {selectedFamilies.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-center pointer-events-auto w-full">
          <div className="w-full sm:max-w-xl">
            <SearchBar
              nodes={allNodes}
              onSelectNode={handleSelectNode}
              selectedNode={selectedNode}
            />
          </div>
        </div>
      </header>

      <main className="w-full h-full">
        <GraphCanvas
          nodes={allNodes}
          links={allLinks}
          selectedNode={selectedNode}
          onSelectNode={handleSelectNode}
          selectedFamilies={selectedFamilies}
          yearRange={yearRange}
          significanceTier={significanceTier}
          searchQuery=""
          graphRef={graphRef}
        />
      </main>

      {isFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-start sm:justify-end sm:p-4 bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none sm:inset-auto sm:top-16 sm:right-3 pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFilterOpen(false);
          }}
        >
          <aside className="w-full sm:w-80 max-h-[85vh] sm:max-h-none overflow-y-auto animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-150">
            <FilterToolbar
              selectedFamilies={selectedFamilies}
              onToggleFamily={handleToggleFamily}
              onClearFamilies={() => setSelectedFamilies([])}
              yearRange={yearRange}
              onYearChange={setYearRange}
              significanceTier={significanceTier}
              onSignificanceTierChange={setSignificanceTier}
              visibleCount={visibleCount}
              totalCount={allNodes.length}
              onClose={() => setIsFilterOpen(false)}
            />
          </aside>
        </div>
      )}

      {selectedNode && (
        <>
          <div
            className="fixed inset-0 z-30 sm:hidden pointer-events-auto"
            onClick={() => setSelectedNode(null)}
          />
          <InspectorDrawer
            key={selectedNode.id}
            selectedNode={selectedNode}
            allNodes={allNodes}
            allLinks={allLinks}
            onClose={() => setSelectedNode(null)}
            onSelectNode={handleSelectNode}
            onOpenComparator={(node) => setComparatorSourceNode(node)}
          />
        </>
      )}

      {comparatorSourceNode && (
        <SystemComparator
          sourceNode={comparatorSourceNode}
          allNodes={allNodes}
          allLinks={allLinks}
          onClose={() => setComparatorSourceNode(null)}
          onSelectNode={handleSelectNode}
        />
      )}
    </div>
  );
}
