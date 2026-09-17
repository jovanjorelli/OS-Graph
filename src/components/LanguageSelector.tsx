import React, { useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LanguageOption } from '../utils/languages';

interface LanguageSelectorProps {
  currentLanguage: LanguageOption;
  onSelectLanguage: (lang: LanguageOption) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onSelectLanguage,
  isOpen,
  onToggle,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Select language: currently ${currentLanguage.name}`}
        className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-mono border transition-all active:scale-95 shadow-lg ${
          isOpen
            ? 'bg-neutral-800 border-neutral-700 text-white'
            : 'bg-neutral-950/90 sm:bg-black backdrop-blur-md border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-900'
        }`}
      >
        <span className="text-sm leading-none">{currentLanguage.flag}</span>
        <span className="uppercase font-semibold tracking-wider">{currentLanguage.code}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-neutral-500'}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 pointer-events-auto"
            onClick={onClose}
          />
          <div className="absolute right-0 top-full mt-1.5 w-56 max-h-[70vh] overflow-y-auto bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800/90 rounded-xl shadow-2xl p-1 z-50 divide-y divide-neutral-900/60 no-scrollbar animate-in fade-in zoom-in-95 duration-150 pointer-events-auto">
            <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
              Select Language
            </div>
            <div className="py-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === currentLanguage.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLanguage(lang);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono transition-colors text-left ${
                      isSelected
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'text-neutral-300 hover:bg-neutral-900/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-base leading-none shrink-0">{lang.flag}</span>
                      <div className="truncate">
                        <div className="truncate text-neutral-100">{lang.nativeName}</div>
                        <div className="text-[10px] text-neutral-500 truncate">{lang.name}</div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
