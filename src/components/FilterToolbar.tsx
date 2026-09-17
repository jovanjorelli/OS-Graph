import React from 'react';
import { Filter, RotateCcw, Calendar, X } from 'lucide-react';
import type { OperatingSystemFamily } from '../types/os';
import { FAMILY_NEON_PALETTE, FAMILY_NAMES } from '../utils/colors';
import { t } from '../utils/languages';

interface FilterToolbarProps {
  selectedFamilies: OperatingSystemFamily[];
  onToggleFamily: (family: OperatingSystemFamily) => void;
  onClearFamilies: () => void;
  yearRange: [number, number];
  onYearChange: (range: [number, number]) => void;
  visibleCount: number;
  totalCount: number;
  onClose?: () => void;
  langCode?: string;
}

const ALL_FAMILIES: OperatingSystemFamily[] = [
  'unix',
  'bsd',
  'linux',
  'windows',
  'apple',
  'independent',
];

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  selectedFamilies,
  onToggleFamily,
  onClearFamilies,
  yearRange,
  onYearChange,
  visibleCount,
  totalCount,
  onClose,
  langCode = 'en',
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 sm:p-4 bg-neutral-950/95 backdrop-blur-2xl border-t sm:border border-neutral-800/90 rounded-t-3xl sm:rounded-2xl shadow-2xl text-[11px] sm:text-xs select-none">
      <button
        onClick={onClose}
        className="w-full flex justify-center py-1 -mt-1 mb-1 focus:outline-none sm:hidden shrink-0 cursor-pointer group"
        aria-label={t('close', langCode)}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-700/80 group-active:bg-neutral-500 transition-colors" />
      </button>
      <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-neutral-800/80">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-100 text-xs tracking-tight">
            {t('graphFilters', langCode)}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="font-mono text-[10px] sm:text-[11px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-800">
            <span className="text-white font-semibold">{visibleCount.toLocaleString()}</span>
            <span className="text-neutral-500"> / </span>
            <span>{totalCount.toLocaleString()}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors sm:hidden"
              aria-label={t('close', langCode)}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
            {t('islandsSectors', langCode)}
          </span>
          {selectedFamilies.length > 0 && (
            <button
              onClick={onClearFamilies}
              className="flex items-center space-x-1 text-[10px] font-mono text-neutral-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{t('reset', langCode)}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {ALL_FAMILIES.map((family) => {
            const isSelected = selectedFamilies.includes(family);
            const palette = FAMILY_NEON_PALETTE[family];

            return (
              <button
                key={family}
                onClick={() => onToggleFamily(family)}
                className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs border transition-all active:scale-[0.98] ${
                  isSelected
                    ? 'bg-neutral-800/90 border-neutral-600 text-white font-medium shadow-sm'
                    : 'bg-neutral-900/40 border-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: palette.core }}
                />
                <span className="truncate">{FAMILY_NAMES[family]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-neutral-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
          <span className="flex items-center space-x-1 uppercase tracking-wider">
            <Calendar className="w-3 h-3 text-neutral-500" />
            <span>{t('timeline', langCode)}</span>
          </span>
          <span className="text-neutral-200 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
            {yearRange[0]} — {yearRange[1]}
          </span>
        </div>
        <input
          type="range"
          min={1950}
          max={2026}
          value={yearRange[0]}
          onChange={(e) => onYearChange([Number(e.target.value), yearRange[1]])}
          className="w-full accent-neutral-300 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
          title="Earliest inception year"
        />
      </div>
    </div>
  );
};
