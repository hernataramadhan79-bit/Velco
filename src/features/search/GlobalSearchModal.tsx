import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { Search, X, FileText, CheckSquare, Link2, Folder, Star, ArrowRight, Loader2 } from 'lucide-react';
import { Item, ItemType } from '../../types/item';
import { db } from '../../services/database';
import { useFocusTrap } from '../../components/common/useFocusTrap';

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
  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<Item[]>([]);
  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const latestQueryRef = useRef(query);

  useFocusTrap(modalContainerRef, isOpen, onClose);

  const search = useCallback(async (q: string) => {
    latestQueryRef.current = q;
    setIsLoading(true);
    try {
      const items = await db.search(q);
      if (latestQueryRef.current === q) {
        setResults(items);
        setSelectedIndex(0);
      }
    } catch (err) {
      if (latestQueryRef.current === q) {
        console.error('Search error:', err);
      }
    } finally {
      if (latestQueryRef.current === q) {
        setIsLoading(false);
      }
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
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, search]);

  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((i) => i.type === activeFilter);

  // Keyboard navigation
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
  };

    useEffect(() => {
    if (isOpen) {
      search(debouncedQuery);
    }
  }, [debouncedQuery, isOpen, search]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalContainerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-100 select-none"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-white/95 dark:bg-[#141418]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-200 dark:border-white/[0.1] overflow-hidden flex flex-col max-h-[70vh] z-10 view-enter">
        {/* Search input header */}
        <div className="flex items-center gap-3 px-3.5 py-3 border-b border-slate-200 dark:border-white/[0.07] bg-slate-50/80 dark:bg-[#101014]">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-blue-500 dark:text-blue-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 stroke-[1.5]" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search notes, tasks, files, links..."
            aria-label="Search workstation items"
            className="flex-1 bg-transparent text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none font-sans"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                search('');
              }}
              className="text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 cursor-pointer p-0.5"
              title="Clear search text"
            >
              <X className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/60 dark:bg-[#0d0d10] border-b border-slate-200 dark:border-white/[0.06] text-xs">
          {(['all', 'note', 'task', 'link', 'file'] as (ItemType | 'all')[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setActiveFilter(f);
                setSelectedIndex(0);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize transition-colors cursor-pointer ${
                activeFilter === f
                  ? 'bg-white dark:bg-white/[0.1] text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-white/[0.12] shadow-xs'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              {f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-mono text-slate-400 dark:text-zinc-500">
            {filteredResults.length} {filteredResults.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {/* Search Results list */}
        <div
          ref={resultsContainerRef}
          className="overflow-y-auto overflow-x-hidden p-1.5 space-y-0.5"
        >
          {filteredResults.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 dark:text-zinc-500 font-mono">
              No matching items found for &ldquo;{query}&rdquo;
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
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-md transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-zinc-100'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] border border-transparent text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 shrink-0">
                      {item.type === 'task' ? (
                        <CheckSquare className="w-3.5 h-3.5 stroke-[1.5]" />
                      ) : item.type === 'link' ? (
                        <Link2 className="w-3.5 h-3.5 stroke-[1.5]" />
                      ) : item.type === 'file' ? (
                        <Folder className="w-3.5 h-3.5 stroke-[1.5]" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 stroke-[1.5]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate text-slate-900 dark:text-zinc-100">
                        {item.title}
                      </div>
                      {item.content && (
                        <div className="text-[11px] text-slate-500 dark:text-zinc-500 truncate mt-0.5 font-mono">
                          {item.content.replace(/^[#*-]\s+/gm, '')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.favorite && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                      {item.type}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 transition-colors ${
                      isSelected ? 'text-slate-700 dark:text-zinc-200 translate-x-0.5' : 'text-slate-400 dark:text-zinc-600 group-hover:text-slate-600 dark:group-hover:text-zinc-400'
                    }`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Keyboard hints footer */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-[#101014] border-t border-slate-200 dark:border-white/[0.07] text-[10px] font-mono text-slate-500 dark:text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300">↵</kbd> Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-zinc-300">esc</kbd> Dismiss
          </span>
        </div>
      </div>
    </div>
  );
};
