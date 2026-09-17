import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import type { OperatingSystemNode } from '../types/os';
import { FAMILY_NEON_PALETTE, FAMILY_NAMES } from '../utils/colors';

interface SearchBarProps {
  nodes: OperatingSystemNode[];
  onSelectNode: (node: OperatingSystemNode) => void;
  selectedNode: OperatingSystemNode | null;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  nodes,
  onSelectNode,
  selectedNode,
  placeholder = 'Search...',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchIndex = useMemo(() => {
    return nodes.map((node) => ({
      node,
      nameLower: node.name.toLowerCase(),
      developerLower: node.developer.toLowerCase(),
      kernelLower: node.kernelName.toLowerCase(),
      yearStr: node.inceptionYear.toString(),
    }));
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: OperatingSystemNode[] = [];
    for (let i = 0; i < searchIndex.length; i++) {
      const item = searchIndex[i];
      if (
        item.nameLower.includes(q) ||
        item.developerLower.includes(q) ||
        item.kernelLower.includes(q) ||
        item.yearStr.includes(q)
      ) {
        results.push(item.node);
        if (results.length >= 10) break;
      }
    }
    return results;
  }, [query, searchIndex]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (node: OperatingSystemNode) => {
    onSelectNode(node);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredNodes.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredNodes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredNodes.length) % filteredNodes.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNodes[highlightedIndex]) {
        handleSelect(filteredNodes[highlightedIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 sm:pl-10 pr-8 py-1.5 sm:py-2 bg-neutral-950/90 text-[11px] sm:text-xs text-neutral-100 placeholder-neutral-500 rounded-xl border border-neutral-800/80 shadow-lg backdrop-blur-xl focus:outline-none focus:border-neutral-600 transition-colors"
        />
        <Search className="absolute left-2.5 sm:left-3 z-10 w-4 h-4 text-neutral-400 pointer-events-none" />
        {query && (
          <div className="absolute right-2.5 flex items-center">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isOpen && filteredNodes.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1.5 bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800/90 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-neutral-900 max-h-72 overflow-y-auto"
        >
          {filteredNodes.map((node, index) => {
            const isHighlighted = index === highlightedIndex;
            const isSelected = selectedNode?.id === node.id;
            const palette = FAMILY_NEON_PALETTE[node.family];

            return (
              <button
                key={node.id}
                onClick={() => handleSelect(node)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full flex items-center justify-between p-2.5 text-left text-xs transition-colors ${
                  isHighlighted
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-300 hover:bg-neutral-900/50'
                } ${isSelected ? 'border-l-2 border-white' : ''}`}
              >
                <div className="flex items-center space-x-2.5 truncate min-w-0 pr-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: palette?.core || '#a3a3a3' }}
                  />
                  <div className="truncate">
                    <div className="font-semibold text-neutral-100 truncate">{node.name}</div>
                    <div className="text-[10px] text-neutral-400 truncate font-mono">
                      {node.kernelName} · {node.developer}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pl-2 shrink-0 font-mono text-[10px] text-neutral-400">
                  <span>{FAMILY_NAMES[node.family]}</span>
                  <span className="px-1.5 py-0.5 bg-neutral-900 rounded border border-neutral-800">
                    {node.inceptionYear}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {isOpen && query.trim() !== '' && filteredNodes.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 p-3 text-center text-xs text-neutral-500 bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800/90 rounded-xl shadow-2xl font-mono">
          No operating systems found
        </div>
      )}
    </div>
  );
};
