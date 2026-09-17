import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import type { OperatingSystemNode, LineageLink, WikipediaSummary } from '../types/os';
import {
  FAMILY_NEON_PALETTE,
  FAMILY_NAMES,
  KERNEL_LABELS,
  getReleaseEra,
} from '../utils/colors';
import { fetchWikipediaSummary, isTrustedWikimediaUrl } from '../services/wikipedia';
import { t, type LanguageOption } from '../utils/languages';

interface InspectorDrawerProps {
  selectedNode: OperatingSystemNode;
  allNodes: OperatingSystemNode[];
  allLinks: LineageLink[];
  onClose: () => void;
  onSelectNode: (node: OperatingSystemNode) => void;
  onOpenComparator?: (node: OperatingSystemNode) => void;
  currentLanguage?: LanguageOption;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  selectedNode,
  allNodes,
  allLinks,
  onClose,
  onSelectNode,
  onOpenComparator,
  currentLanguage,
}) => {
  const langCode = currentLanguage?.code || 'en';
  const currentKey = `${selectedNode.wikipediaTitle}::${selectedNode.name}::${langCode}`;
  const [loadedKey, setLoadedKey] = useState<string>('');
  const [wikiSummary, setWikiSummary] = useState<WikipediaSummary | null>(null);
  const isLoadingWiki = loadedKey !== currentKey;
  const [isLightboxOpen, setIsLightboxOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return new URLSearchParams(window.location.search).get('lightbox') === '1';
      } catch {
        return false;
      }
    }
    return false;
  });
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [prevTrackedKey, setPrevTrackedKey] = useState(currentKey);

  if (prevTrackedKey !== currentKey) {
    setPrevTrackedKey(currentKey);
    setActivePhotoIndex(0);
  }

  const activeSummary = loadedKey === currentKey ? wikiSummary : null;

  const albumPhotos = useMemo(() => {
    if (isLoadingWiki || !activeSummary) {
      return [];
    }
    if (activeSummary.albumPhotos && activeSummary.albumPhotos.length > 0) {
      return activeSummary.albumPhotos;
    }
    if (activeSummary.album && activeSummary.album.length > 0) {
      return activeSummary.album.map((url) => {
        let badge = '🌐 Wiki';
        if (url.includes('/ru.') || url.includes('/wikipedia/ru')) badge = '🇷🇺 RU';
        else if (url.includes('/en.') || url.includes('/wikipedia/en')) badge = '🇺🇸 EN';
        return { url, sourceLang: 'en', badge };
      });
    }
    if (activeSummary.thumbnailUrl) {
      const flagBadge = currentLanguage?.flag
        ? `${currentLanguage.flag} ${currentLanguage.code.toUpperCase()}`
        : '🌐 Wiki';
      return [{ url: activeSummary.thumbnailUrl, sourceLang: currentLanguage?.code || 'en', badge: flagBadge }];
    }
    return [];
  }, [activeSummary, currentLanguage, isLoadingWiki]);

  const album = useMemo(() => {
    return albumPhotos.map((p) => p.url);
  }, [albumPhotos]);

  const currentPhoto = album[activePhotoIndex] || album[0] || activeSummary?.thumbnailUrl;
  const currentPhotoBadge = albumPhotos[activePhotoIndex]?.badge || albumPhotos[0]?.badge || null;

  const handlePrevPhoto = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : album.length - 1));
  }, [album.length]);

  const handleNextPhoto = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setActivePhotoIndex((prev) => (prev < album.length - 1 ? prev + 1 : 0));
  }, [album.length]);

  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
  });
  const touchDistStartRef = useRef<number | null>(null);
  const touchScaleStartRef = useRef<number>(1);
  const touchPanStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
  });
  const lastTapTimeRef = useRef<number>(0);

  const clampPan = (x: number, y: number, scale: number): { x: number; y: number } => {
    if (scale <= 1.0) {
      return { x: 0, y: 0 };
    }
    const maxPanX = Math.max(0, ((window.innerWidth * 0.96) * (scale - 1)) / 2 + 30);
    const maxPanY = Math.max(0, ((window.innerHeight * 0.92) * (scale - 1)) / 2 + 30);
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, y)),
    };
  };

  const handleOpenLightbox = () => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setIsPanning(false);
  };

  const handleDoubleAction = () => {
    setZoomScale((prev) => {
      if (prev > 1.05) {
        setPanOffset({ x: 0, y: 0 });
        return 1.0;
      }
      setPanOffset({ x: 0, y: 0 });
      return 2.5;
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    setZoomScale((prev) => {
      const next = Math.max(1.0, Math.min(4.0, Number((prev + delta).toFixed(2))));
      setPanOffset((prevPan) => clampPan(prevPan.x, prevPan.y, next));
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || zoomScale <= 1.0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || zoomScale <= 1.0) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanOffset(clampPan(panStartRef.current.originX + dx, panStartRef.current.originY + dy, zoomScale));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleLightboxTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistStartRef.current = dist;
      touchScaleStartRef.current = zoomScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleAction();
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      if (zoomScale > 1.0) {
        touchPanStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          originX: panOffset.x,
          originY: panOffset.y,
        };
        setIsPanning(true);
      }
    }
  };

  const handleLightboxTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchDistStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistStartRef.current;
      const next = Math.max(1.0, Math.min(4.0, Number((touchScaleStartRef.current * ratio).toFixed(2))));
      setZoomScale(next);
      setPanOffset((prevPan) => clampPan(prevPan.x, prevPan.y, next));
    } else if (e.touches.length === 1 && isPanning && zoomScale > 1.0) {
      const dx = e.touches[0].clientX - touchPanStartRef.current.x;
      const dy = e.touches[0].clientY - touchPanStartRef.current.y;
      setPanOffset(clampPan(touchPanStartRef.current.originX + dx, touchPanStartRef.current.originY + dy, zoomScale));
    }
  };

  const handleLightboxTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      touchDistStartRef.current = null;
    }
    if (e.touches.length === 0) {
      setIsPanning(false);
      setZoomScale((prev) => {
        if (prev < 1.05) {
          setPanOffset({ x: 0, y: 0 });
          return 1.0;
        }
        return prev;
      });
    }
  };

  const getMaxExpandedHeight = (): number => {
    if (typeof window === 'undefined') return 520;
    const searchInput = document.querySelector('header input[type="text"]');
    if (searchInput) {
      const rect = searchInput.getBoundingClientRect();
      return Math.max(220, Math.round(window.innerHeight - rect.bottom - 10));
    }
    return Math.max(220, window.innerHeight - 150);
  };

  const [sheetHeight, setSheetHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const isExp = new URLSearchParams(window.location.search).get('expanded') === '1';
        if (isExp) return Math.round(window.innerHeight * 0.88);
      } catch {
        return 400;
      }
      return Math.round(window.innerHeight * 0.52);
    }
    return 400;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseLightbox();
      } else if (e.key === 'ArrowLeft' && album.length > 1) {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight' && album.length > 1) {
        handleNextPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, album.length, handlePrevPhoto, handleNextPhoto]);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
    dragStartHeightRef.current = sheetHeight;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = dragStartYRef.current - e.touches[0].clientY;
    const maxAllowed = getMaxExpandedHeight();
    const newH = Math.max(160, Math.min(maxAllowed, dragStartHeightRef.current + deltaY));
    setSheetHeight(newH);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const maxH = getMaxExpandedHeight();
    const halfH = Math.round(window.innerHeight * 0.52);
    const peekH = Math.round(window.innerHeight * 0.32);

    if (sheetHeight < 180) {
      onClose();
      return;
    }

    if (sheetHeight > halfH + (maxH - halfH) / 2) {
      setSheetHeight(maxH);
    } else if (sheetHeight < halfH - (halfH - peekH) / 2) {
      setSheetHeight(peekH);
    } else {
      setSheetHeight(halfH);
    }
  };

  const handleHandleClick = () => {
    const maxH = getMaxExpandedHeight();
    const halfH = Math.round(window.innerHeight * 0.52);
    setSheetHeight((prev) => (prev >= maxH - 24 ? halfH : maxH));
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchWikipediaSummary(
      selectedNode.wikipediaTitle,
      selectedNode.name,
      currentLanguage?.code || 'en',
      controller.signal,
      (progressiveSummary) => {
        if (!controller.signal.aborted) {
          setWikiSummary({ ...progressiveSummary });
          setLoadedKey(currentKey);
        }
      }
    )
      .then((summary) => {
        if (!controller.signal.aborted) {
          setWikiSummary(summary ? { ...summary } : null);
          setLoadedKey(currentKey);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWikiSummary(null);
          setLoadedKey(currentKey);
        }
      });

    return () => {
      controller.abort();
    };
  }, [currentKey, selectedNode.wikipediaTitle, selectedNode.name, currentLanguage?.code]);

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

  const isNonEnglish = Boolean(currentLanguage && currentLanguage.code !== 'en');
  const hasLocalizedWiki = Boolean(isNonEnglish && activeSummary && !activeSummary.isFallback && activeSummary.extract);
  const isFallbackWiki = Boolean(isNonEnglish && activeSummary?.isFallback);
  const isMissingWiki = Boolean(!isLoadingWiki && !activeSummary);

  return (
    <>
      <aside
        style={{
          height: typeof window !== 'undefined' && window.innerWidth < 640 ? `${sheetHeight}px` : undefined,
          maxHeight: typeof window !== 'undefined' && window.innerWidth < 640 ? 'calc(100vh - 68px)' : undefined,
          transition: isDragging ? 'none' : 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="fixed inset-x-0 bottom-0 z-40 sm:max-h-none sm:top-16 sm:right-4 sm:bottom-4 sm:w-[440px] sm:inset-x-auto bg-neutral-950/95 backdrop-blur-2xl border-t sm:border border-neutral-800/80 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-right-3 duration-200"
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleHandleClick}
          className="w-full flex flex-col items-center py-2.5 -mt-0.5 focus:outline-none sm:hidden shrink-0 cursor-grab active:cursor-grabbing touch-none select-none group"
          aria-label="Drag or tap to resize panel"
        >
          <div className="w-12 h-1.5 rounded-full bg-neutral-700/80 group-hover:bg-neutral-500 transition-colors" />
        </div>
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, transparent, ${palette.core}, transparent)`,
          }}
        />

        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-800/80">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <span
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
              style={{
                backgroundColor: palette.core,
                boxShadow: `0 0 10px ${palette.core}80`,
              }}
            />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
              {selectedNode.name}
            </h2>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            {onOpenComparator && (
              <button
                onClick={() => onOpenComparator(selectedNode)}
                className="flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all active:scale-95 shadow-sm"
                title="Compare with another OS"
              >
                <ArrowRightLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
                <span>{t('compare', langCode)}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors focus:outline-none active:scale-95 shrink-0"
              aria-label={t('close', langCode)}
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 text-xs">
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

          <div
            className="p-3 sm:p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 text-[11px] sm:text-xs text-neutral-300 leading-relaxed space-y-2"
            style={{ borderLeftWidth: '3px', borderLeftColor: palette.core }}
          >
            {isNonEnglish && hasLocalizedWiki && (
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400 font-semibold tracking-wider uppercase">
                <span>{currentLanguage?.flag}</span>
                <span>{currentLanguage?.name} {t('wikipediaDossier', langCode)}</span>
              </div>
            )}

            {isFallbackWiki && currentLanguage && (
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
                <span className="shrink-0">{currentLanguage.flag}</span>
                <span className="truncate">{t('unavailableIn', langCode)} {currentLanguage.name} — {t('showingEnglish', langCode)}</span>
              </div>
            )}

            {isMissingWiki && isNonEnglish && (
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
                <span className="shrink-0">{currentLanguage?.flag || '🌐'}</span>
                <span className="truncate">{t('unavailableIn', langCode)} {currentLanguage?.name}</span>
              </div>
            )}

            {isNonEnglish && isLoadingWiki ? (
              <div className="flex items-center space-x-2 text-neutral-400 py-1 font-mono text-[11px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
                <span>{t('syncing', langCode)} {currentLanguage?.name}...</span>
              </div>
            ) : (
              <p>
                {(isNonEnglish && hasLocalizedWiki ? activeSummary?.extract : null) ||
                  selectedNode.description ||
                  `${selectedNode.name} is an operating system developed in ${selectedNode.inceptionYear}.`}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 text-[11px] sm:text-xs">
            <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-2.5 sm:p-3 space-y-0.5 sm:space-y-1 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
                <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500" />
                <span>{t('kernel', langCode)}</span>
              </div>
              <div className="font-semibold text-neutral-100 truncate text-[11px] sm:text-xs">
                {KERNEL_LABELS[selectedNode.kernelType]}
              </div>
              <div
                className="text-[10px] sm:text-[11px] text-neutral-400 truncate font-mono"
                title={selectedNode.kernelName}
              >
                {selectedNode.kernelName}
              </div>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-2.5 sm:p-3 space-y-0.5 sm:space-y-1 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
                <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500" />
                <span>{t('inception', langCode)}</span>
              </div>
              <div className="font-semibold text-neutral-100 text-[11px] sm:text-xs">
                {selectedNode.inceptionYear}
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate font-mono">
                {getReleaseEra(selectedNode.inceptionYear)}
              </div>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-2.5 sm:p-3 space-y-0.5 sm:space-y-1 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
                <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500" />
                <span>{t('developer', langCode)}</span>
              </div>
              <div
                className="font-semibold text-neutral-100 truncate text-[11px] sm:text-xs"
                title={selectedNode.developer}
              >
                {selectedNode.developer}
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-500 truncate font-mono">
                {t('primaryAuthor', langCode)}
              </div>
            </div>

            <div className="bg-neutral-900/40 border border-neutral-800/70 rounded-xl p-2.5 sm:p-3 space-y-0.5 sm:space-y-1 hover:border-neutral-700/80 transition-colors">
              <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] text-neutral-400 uppercase font-mono tracking-wider">
                <Scale className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-500" />
                <span>{t('license', langCode)}</span>
              </div>
              <div
                className="font-semibold text-neutral-100 truncate text-[11px] sm:text-xs"
                title={selectedNode.license}
              >
                {selectedNode.license}
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-500 truncate font-mono">
                {t('distributionTerms', langCode)}
              </div>
            </div>
          </div>

          {selectedNode.architectures.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5 text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                <Cpu className="w-3 h-3 text-neutral-500" />
                <span>{t('targetArchitectures', langCode)}</span>
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
              <span>{t('lineageRelationships', langCode)}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="text-[10px] font-mono text-neutral-400 mb-1.5 uppercase">
                  {t('upstreamArchitecture', langCode)}
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
                    <span>{t('rootArchitecture', langCode)}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase">
                    {t('downstreamDerivatives', langCode)}
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
                    {t('terminalDistribution', langCode)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-3 border-t border-neutral-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 flex items-center space-x-1.5">
                <BookOpen className="w-3 h-3 text-neutral-500" />
                <span>{t('wikipediaDossier', langCode)}</span>
              </span>
              {isLoadingWiki && (
                <span className="flex items-center space-x-1 text-[10px] font-mono text-neutral-500">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>{t('syncing', langCode)}</span>
                </span>
              )}
            </div>

            {isLoadingWiki ? (
              <div className="space-y-3 bg-neutral-900/40 rounded-xl p-3.5 border border-neutral-800/70 animate-in fade-in duration-150">
                <div className="relative flex flex-col items-center justify-center p-6 rounded-xl border border-neutral-800/80 bg-neutral-950/70 min-h-[160px] overflow-hidden">
                  <div className="absolute inset-0 bg-radial from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
                  <div className="relative z-10 flex flex-col items-center space-y-3 text-center">
                    <div className="relative flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border border-cyan-500/20 bg-cyan-500/10 animate-ping absolute" />
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin relative z-10" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-mono font-medium text-neutral-200">
                        {t('loadingMaterials', langCode)}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 truncate max-w-[240px]">
                        {selectedNode.name} • {currentLanguage?.name || 'English'}
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-2 inset-x-3 flex items-center justify-center space-x-1.5 opacity-40">
                    <div className="w-12 h-1 bg-cyan-500/40 rounded-full animate-pulse" />
                    <div className="w-8 h-1 bg-neutral-700 rounded-full animate-pulse" />
                    <div className="w-16 h-1 bg-neutral-700 rounded-full animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="h-3 bg-neutral-800/60 rounded w-full animate-pulse" />
                  <div className="h-3 bg-neutral-800/50 rounded w-5/6 animate-pulse" />
                  <div className="h-3 bg-neutral-800/40 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-neutral-900/40 rounded-xl p-3.5 border border-neutral-800/70">
                {activeSummary?.isFallback && currentLanguage && currentLanguage.code !== 'en' && (
                  <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono">
                    <span className="shrink-0">{currentLanguage.flag}</span>
                    <span className="truncate">{t('unavailableIn', langCode)} {currentLanguage.name} — {t('showingEnglish', langCode)}</span>
                  </div>
                )}
                {isMissingWiki && (
                  <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-400 text-[11px] font-mono">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                    <span className="truncate">{t('unavailableIn', langCode)} {currentLanguage?.name || 'language'}</span>
                  </div>
                )}
                {currentPhoto && (
                  <div
                    onClick={handleOpenLightbox}
                    className="group relative flex items-center justify-center p-3 sm:p-4 rounded-xl border border-neutral-800/80 hover:border-neutral-700/90 cursor-zoom-in transition-all overflow-hidden min-h-[145px]"
                    title={t('expandImage', langCode)}
                  >
                    <img
                      src={currentPhoto}
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-45 scale-125 select-none pointer-events-none transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] pointer-events-none" />

                    <img
                      key={currentPhoto}
                      src={currentPhoto}
                      alt={selectedNode.name}
                      className="relative z-10 max-h-36 max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                      style={{ filter: 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.8))' }}
                      loading="lazy"
                    />

                    {album.length > 1 ? (
                      <>
                        <div className="absolute top-2 left-2 z-20 flex items-center space-x-1 text-[10px] font-mono text-neutral-200 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-neutral-800">
                          {currentPhotoBadge && (
                            <span className="font-semibold text-neutral-300 mr-0.5">{currentPhotoBadge}</span>
                          )}
                          <span>{activePhotoIndex + 1}</span>
                          <span className="text-neutral-500">/</span>
                          <span>{album.length}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevPhoto();
                          }}
                          className="absolute left-2 z-20 p-1.5 rounded-full bg-black/70 hover:bg-neutral-800 text-white backdrop-blur-md border border-neutral-800 opacity-80 group-hover:opacity-100 transition-opacity active:scale-90"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextPhoto();
                          }}
                          className="absolute right-2 z-20 p-1.5 rounded-full bg-black/70 hover:bg-neutral-800 text-white backdrop-blur-md border border-neutral-800 opacity-80 group-hover:opacity-100 transition-opacity active:scale-90"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {album.length <= 8 && (
                          <div className="absolute bottom-2 inset-x-0 z-20 flex items-center justify-center space-x-1 pointer-events-none">
                            {album.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1 rounded-full transition-all duration-200 ${
                                  i === activePhotoIndex ? 'w-3 bg-white' : 'w-1 bg-white/40'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      currentPhotoBadge && (
                        <div className="absolute top-2 left-2 z-20 flex items-center text-[10px] font-mono text-neutral-200 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-neutral-800">
                          <span>{currentPhotoBadge}</span>
                        </div>
                      )
                    )}

                    <div className="absolute top-2 right-2 z-20 flex items-center space-x-1 text-[10px] font-mono text-neutral-300 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-neutral-800 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3 h-3" />
                      <span>{t('expandImage', langCode)}</span>
                    </div>
                  </div>
                )}

                {albumPhotos.length > 1 && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                      <span>{t('photoAlbum', langCode)}</span>
                      <span className="text-neutral-500">{albumPhotos.length}</span>
                    </div>
                    <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                      {albumPhotos.map((photo, idx) => (
                        <button
                          key={photo.url}
                          type="button"
                          onClick={() => {
                            setActivePhotoIndex(idx);
                          }}
                          className={`relative group shrink-0 rounded-lg overflow-hidden border transition-all p-1 bg-neutral-900/80 hover:bg-neutral-850 flex flex-col items-center cursor-pointer ${
                            idx === activePhotoIndex
                              ? 'border-cyan-400/80 ring-1 ring-cyan-400/50 shadow-md shadow-cyan-950/50 scale-105'
                              : 'border-neutral-800/80 hover:border-neutral-700 opacity-70 hover:opacity-100'
                          }`}
                          title={`${photo.badge} (${idx + 1}/${albumPhotos.length})`}
                        >
                          <div className="w-14 h-12 flex items-center justify-center overflow-hidden rounded bg-black/40">
                            <img
                              src={photo.url}
                              alt=""
                              className="max-w-full max-h-full object-contain pointer-events-none select-none group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </div>
                          <span className="mt-1 px-1 py-0.5 text-[8px] font-mono font-medium rounded bg-neutral-950/90 text-neutral-300 border border-neutral-800/80 truncate max-w-[56px] text-center">
                            {photo.badge}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {activeSummary?.extract?.replace(/\s*\(\s*(?:;\s*)?\)/g, '') || selectedNode.description}
                </p>
                <div>
                  <a
                    href={
                      activeSummary?.pageUrl && isTrustedWikimediaUrl(activeSummary.pageUrl)
                        ? activeSummary.pageUrl
                        : `https://en.wikipedia.org/wiki/${encodeURIComponent(
                            selectedNode.wikipediaTitle || selectedNode.name
                          )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 text-xs text-neutral-200 hover:text-white font-medium group transition-colors"
                  >
                    <span>{t('viewWikipedia', langCode)}</span>
                    <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-white transition-colors" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {isLightboxOpen && currentPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && zoomScale <= 1.05) {
              handleCloseLightbox();
            }
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-xl p-3 sm:p-5 animate-in fade-in duration-200 select-none touch-none overflow-hidden"
        >
          <img
            key={`lightbox-ambient-${currentPhoto}`}
            src={currentPhoto}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none select-none transition-all duration-300"
          />
          <div className="absolute inset-0 bg-black/60 pointer-events-none" />

          <div className="w-full flex items-center justify-between z-30 pointer-events-auto shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0 pr-4">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: palette.core,
                  boxShadow: `0 0 10px ${palette.core}80`,
                }}
              />
              <span className="text-sm sm:text-base font-semibold text-white truncate tracking-tight">
                {selectedNode.name}
              </span>
              {currentPhotoBadge && (
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 shrink-0">
                  {currentPhotoBadge}
                </span>
              )}
              {album.length > 1 && (
                <span className="text-xs font-mono text-neutral-400 bg-neutral-900/80 border border-neutral-800 px-2 py-0.5 rounded shrink-0">
                  {activePhotoIndex + 1} / {album.length}
                </span>
              )}
            </div>
            <button
              onClick={handleCloseLightbox}
              className="p-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors focus:outline-none border border-neutral-800 active:scale-95 shrink-0"
              aria-label={t('close', langCode)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            onWheel={handleWheel}
            onDoubleClick={handleDoubleAction}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxTouchEnd}
            className={`relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden cursor-default p-2 sm:p-4 z-20 ${
              zoomScale > 1.0 ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
            }`}
          >
            <img
              key={`lightbox-img-${currentPhoto}`}
              src={currentPhoto}
              alt={selectedNode.name}
              draggable={false}
              style={{
                transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomScale})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.12s ease-out',
                filter: 'drop-shadow(0 25px 40px rgba(0, 0, 0, 0.85))',
              }}
              className="max-h-full max-w-full w-auto h-auto object-contain select-none pointer-events-none"
            />

            {album.length > 1 && zoomScale <= 1.05 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevPhoto();
                  }}
                  className="absolute left-2 sm:left-4 z-30 p-2.5 sm:p-3 rounded-full bg-black/65 hover:bg-neutral-800 text-white backdrop-blur-md border border-neutral-750/80 active:scale-90 transition-all shadow-2xl"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextPhoto();
                  }}
                  className="absolute right-2 sm:right-4 z-30 p-2.5 sm:p-3 rounded-full bg-black/65 hover:bg-neutral-800 text-white backdrop-blur-md border border-neutral-750/80 active:scale-90 transition-all shadow-2xl"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </>
            )}
          </div>

          <div className="w-full flex items-center justify-center py-1 z-30 pointer-events-auto shrink-0">
            {zoomScale > 1.05 ? (
              <button
                onClick={() => {
                  setZoomScale(1.0);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono text-neutral-300 hover:text-white shadow-lg active:scale-95 transition-all"
              >
                <span>{Math.round(zoomScale * 100)}%</span>
                <span className="text-neutral-500">•</span>
                <span className="text-cyan-400">{t('resetZoom', langCode)}</span>
              </button>
            ) : album.length > 1 ? (
              <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-neutral-800">
                {album.length <= 10 ? (
                  album.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setZoomScale(1.0);
                        setPanOffset({ x: 0, y: 0 });
                        setActivePhotoIndex(i);
                      }}
                      className={`h-1.5 rounded-full transition-all duration-200 ${
                        i === activePhotoIndex ? 'w-4 bg-white' : 'w-1.5 bg-neutral-600 hover:bg-neutral-400'
                      }`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))
                ) : (
                  <span className="text-xs font-mono text-neutral-300">
                    {activePhotoIndex + 1} / {album.length}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-[11px] font-mono text-neutral-500 tracking-wider uppercase">
                {FAMILY_NAMES[selectedNode.family]}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
