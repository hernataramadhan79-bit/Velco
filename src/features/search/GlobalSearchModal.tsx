import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, CheckSquare, Link2, FileIcon, Star, ArrowRight, Loader2 } from 'lucide-react';
import { Item, ItemType } from '../../types/item';
import { db } from '../../services/database';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: Item) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectItem,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Item[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const items = await db.search(q);
      setResults(items);
      setSelectedIndex(0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }

  // Initial focus and search
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        search('');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, search]);

  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((i) => i.type === activeFilter);

  // Keyboard navigation: Escape, ArrowDown, ArrowUp, Enter
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (filteredResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredResults.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredResults[selectedIndex];
        if (selected) {
          onSelectItem(selected);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose, onSelectItem]);

  // Keep selected item visible in viewport
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const activeEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[70vh] z-10 view-enter">
        {/* Search input header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search notes, tasks, links, tags, URLs..."
            aria-label="Search items"
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                search('');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              title="Clear search text"
              aria-label="Clear search text"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal (Esc)"
            aria-label="Close search modal"
          >
            <span>Close</span>
            <kbd className="px-1 py-0.2 rounded bg-slate-200/70 dark:bg-slate-800 text-[10px] font-mono text-slate-500">
              ESC
            </kbd>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50/60 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 text-xs">
          {(['all', 'note', 'task', 'link', 'file'] as (ItemType | 'all')[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setActiveFilter(f);
                setSelectedIndex(0);
              }}
              className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                activeFilter === f
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-400">
            {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {/* Search Results list */}
        <div
          ref={resultsContainerRef}
          className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60"
        >
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">
              No matching items found for "{query}"
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectItem(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      isSelected ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {item.type === 'task' ? (
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      ) : item.type === 'link' ? (
                        <Link2 className="w-3.5 h-3.5 text-blue-500" />
                      ) : item.type === 'file' ? (
                        <FileIcon className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-semibold truncate ${
                        isSelected ? 'text-blue-950 dark:text-blue-100 font-bold' : 'text-slate-900 dark:text-slate-100'
                      }`}>
                        {item.title}
                      </div>
                      {item.content && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.content.replace(/^[#*-]\s+/gm, '')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                      isSelected ? 'text-blue-600 dark:text-blue-400 translate-x-0.5' : 'text-slate-400 group-hover:text-blue-500'
                    }`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard hint footer */}
        {filteredResults.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px]">↑</kbd>
                <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px] ml-1">↓</kbd> to navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px]">↵</kbd> to select
              </span>
            </div>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px]">ESC</kbd> to exit
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
