import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { SlidersHorizontal, Globe } from 'lucide-react';
import type { ForceGraphGeneric } from 'force-graph';
import { CURATED_NODES, CURATED_LINKS } from './data/curatedDataset';
import type { OperatingSystemNode, LineageLink, OperatingSystemFamily } from './types/os';
import { GraphCanvas } from './components/GraphCanvas';
import { InspectorDrawer } from './components/InspectorDrawer';
import { SearchBar } from './components/SearchBar';
import { FilterToolbar } from './components/FilterToolbar';
import { SystemComparator } from './components/SystemComparator';
import { LanguageSelector } from './components/LanguageSelector';
import { FAMILY_NEON_PALETTE, FAMILY_NAMES } from './utils/colors';
import { getSavedLanguage, saveLanguage, t, type LanguageOption } from './utils/languages';

const SECTOR_COORDINATES: Record<string, { x: number; y: number; zoom: number }> = {
  overview: { x: 0, y: 300, zoom: 0.04 },
  all: { x: 0, y: 300, zoom: 0.04 },
  unix: { x: 0, y: -3900, zoom: 0.35 },
  apple: { x: -3900, y: -1500, zoom: 0.35 },
  bsd: { x: 3900, y: -1500, zoom: 0.35 },
  windows: { x: -3900, y: 2100, zoom: 0.35 },
  linux: { x: 3900, y: 2100, zoom: 0.35 },
  independent: { x: 0, y: 4500, zoom: 0.35 },
};

export function App() {
  const [selectedNode, setSelectedNode] = useState<OperatingSystemNode | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const osParam = params.get('os');
        if (osParam) {
          return (
            CURATED_NODES.find(
              (n) => n.id.toLowerCase() === osParam.toLowerCase() || n.name.toLowerCase() === osParam.toLowerCase()
            ) || null
          );
        }
      } catch {
        return null;
      }
    }
    return null;
  });
  const [selectedFamilies, setSelectedFamilies] = useState<OperatingSystemFamily[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([1950, 2026]);
  const [isFilterOpen, setIsFilterOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        return params.get('filters') === '1' || params.get('filters') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(getSavedLanguage);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [activeSector, setActiveSector] = useState<string>('overview');
  const [comparatorSourceNode, setComparatorSourceNode] = useState<OperatingSystemNode | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const compParam = params.get('compare');
        if (compParam) {
          return (
            CURATED_NODES.find(
              (n) => n.id.toLowerCase() === compParam.toLowerCase() || n.name.toLowerCase() === compParam.toLowerCase()
            ) || null
          );
        }
      } catch {
        return null;
      }
    }
    return null;
  });

  const graphRef = useRef<ForceGraphGeneric<any, OperatingSystemNode, LineageLink> | null>(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = selectedLanguage.code;
    }
  }, [selectedLanguage.code]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (selectedNode) {
        url.searchParams.set('os', selectedNode.id);
      } else {
        url.searchParams.delete('os');
      }

      if (comparatorSourceNode) {
        url.searchParams.set('compare', comparatorSourceNode.id);
      } else {
        url.searchParams.delete('compare');
        url.searchParams.delete('target');
        url.searchParams.delete('view');
      }

      if (isFilterOpen) {
        url.searchParams.set('filters', '1');
      } else {
        url.searchParams.delete('filters');
      }

      if (selectedLanguage.code !== 'en') {
        url.searchParams.set('lang', selectedLanguage.code);
      } else {
        url.searchParams.delete('lang');
      }

      const newSearch = url.searchParams.toString();
      const newRelativePathQuery = url.pathname + (newSearch ? `?${newSearch}` : '');
      const currentRelative = window.location.pathname + window.location.search;
      if (newRelativePathQuery !== currentRelative) {
        window.history.replaceState(null, '', newRelativePathQuery);
      }
    } catch {
      return;
    }
  }, [selectedNode, comparatorSourceNode, isFilterOpen, selectedLanguage.code]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const osParam = params.get('os');
        if (osParam) {
          const match = CURATED_NODES.find(
            (n) => n.id.toLowerCase() === osParam.toLowerCase() || n.name.toLowerCase() === osParam.toLowerCase()
          );
          setSelectedNode(match || null);
        } else {
          setSelectedNode(null);
        }

        const compParam = params.get('compare');
        if (compParam) {
          const match = CURATED_NODES.find(
            (n) => n.id.toLowerCase() === compParam.toLowerCase() || n.name.toLowerCase() === compParam.toLowerCase()
          );
          setComparatorSourceNode(match || null);
        } else {
          setComparatorSourceNode(null);
        }

        setIsFilterOpen(params.get('filters') === '1' || params.get('filters') === 'true');
      } catch {
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const allNodes = CURATED_NODES;
  const allLinks = CURATED_LINKS;

  const visibleCount = useMemo(() => {
    return allNodes.filter((node) => {
      const matchesFamily =
        selectedFamilies.length === 0 || selectedFamilies.includes(node.family);
      const matchesYear =
        node.inceptionYear >= yearRange[0] &&
        node.inceptionYear <= yearRange[1];
      return matchesFamily && matchesYear;
    }).length;
  }, [allNodes, selectedFamilies, yearRange]);

  const handleToggleFamily = useCallback((family: OperatingSystemFamily) => {
    setSelectedFamilies((prev) =>
      prev.includes(family) ? prev.filter((f) => f !== family) : [...prev, family]
    );
  }, []);

  const handleSelectNode = useCallback((node: OperatingSystemNode | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
    const isSameNode = selectedNode?.id === node.id;
    if (isSameNode) {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      if (graphRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
        const currentZoom = graphRef.current.zoom() || 1;
        const targetZoom = Math.max(currentZoom, 1.6);
        graphRef.current.centerAt(node.x, node.y, 450);
        graphRef.current.zoom(targetZoom, 450);
      }
    }
    setIsFilterOpen(false);
    setIsLanguageOpen(false);
  }, [selectedNode]);

  const handleToggleFilter = useCallback(() => {
    setIsFilterOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsLanguageOpen(false);
        setSelectedNode(null);
      }
      return next;
    });
  }, []);

  const handleToggleLanguage = useCallback(() => {
    setIsLanguageOpen((prev) => {
      const next = !prev;
      if (next) {
        setIsFilterOpen(false);
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
      <header className={`absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 ${isLanguageOpen ? 'z-[60]' : 'z-30'} pointer-events-none flex flex-col gap-1.5 sm:gap-2`}>
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

          <div className="flex items-center space-x-1.5 pointer-events-auto shrink-0">
            <button
              onClick={handleToggleFilter}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all active:scale-95 shadow-lg ${
                isFilterOpen || selectedFamilies.length > 0
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-neutral-950/90 backdrop-blur-md border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{t('filters', selectedLanguage.code)}</span>
              {selectedFamilies.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            <LanguageSelector
              currentLanguage={selectedLanguage}
              onSelectLanguage={(lang) => {
                setSelectedLanguage(lang);
                saveLanguage(lang.code);
              }}
              isOpen={isLanguageOpen}
              onToggle={handleToggleLanguage}
              onClose={() => setIsLanguageOpen(false)}
            />
          </div>
        </div>

        <div className="flex sm:hidden items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth p-0.5 bg-neutral-950/90 backdrop-blur-md rounded-lg border border-neutral-800/80 shadow-xl text-[10px] font-mono pointer-events-auto w-full">
          <button
            onClick={() => handleJumpToSector('overview')}
            className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
              activeSector === 'overview'
                ? 'bg-neutral-800 text-white font-medium'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t('overview', selectedLanguage.code)}
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
              <span>{allNodes.length.toLocaleString()} {t('systems', selectedLanguage.code)}</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 sm:gap-1.5 p-1 bg-black rounded-lg border border-neutral-800 shadow-xl text-xs font-mono pointer-events-auto justify-self-center">
            <button
              onClick={() => handleJumpToSector('overview')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                activeSector === 'overview'
                  ? 'bg-neutral-800 text-white font-medium'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {t('overview', selectedLanguage.code)}
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

          <div className="flex items-center space-x-2 pointer-events-auto shrink-0 justify-self-end">
            <button
              onClick={handleToggleFilter}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors shadow-lg ${
                isFilterOpen || selectedFamilies.length > 0
                  ? 'bg-neutral-800 border-neutral-700 text-white'
                  : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{t('filters', selectedLanguage.code)}</span>
              {selectedFamilies.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            <LanguageSelector
              currentLanguage={selectedLanguage}
              onSelectLanguage={(lang) => {
                setSelectedLanguage(lang);
                saveLanguage(lang.code);
              }}
              isOpen={isLanguageOpen}
              onToggle={handleToggleLanguage}
              onClose={() => setIsLanguageOpen(false)}
            />
          </div>
        </div>

        <div className="flex justify-center pointer-events-auto w-full">
          <div className="w-full sm:max-w-xl">
            <SearchBar
              nodes={allNodes}
              onSelectNode={handleSelectNode}
              selectedNode={selectedNode}
              placeholder={t('searchPlaceholder', selectedLanguage.code)}
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
              visibleCount={visibleCount}
              totalCount={allNodes.length}
              onClose={() => setIsFilterOpen(false)}
              langCode={selectedLanguage.code}
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
            currentLanguage={selectedLanguage}
          />
        </>
      )}

      {comparatorSourceNode && (
        <SystemComparator
          key={comparatorSourceNode.id}
          sourceNode={comparatorSourceNode}
          allNodes={allNodes}
          allLinks={allLinks}
          onClose={() => setComparatorSourceNode(null)}
          onSelectNode={handleSelectNode}
          currentLanguage={selectedLanguage}
        />
      )}
    </div>
  );
}
