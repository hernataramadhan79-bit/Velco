import React, { useEffect, useRef, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Plus, CheckSquare, Link2, FileText } from 'lucide-react';
import { useItemStore } from '../../stores/itemStore';

/**
 * Komponen Quick Capture untuk spotlight window (/?window=spotlight).
 * Auto-focus on mount, Escape = tutup, Enter = simpan dan tutup.
 * Dilengkapi dengan auto-detection tipe (task, link, note).
 */
export const SpotlightCaptureView: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const captureItem = useItemStore((s) => s.captureItem);

  const detectedType = useMemo<'task' | 'link' | 'note'>(() => {
    const trimmed = input.trim();
    if (/^(https?:\/\/|www\.)\S+$/i.test(trimmed)) return 'link';
    if (/^(\[ ?\]|todo:|task:|- \[ \])/i.test(trimmed)) return 'task';
    return 'note';
  }, [input]);

  // Auto-focus saat komponen di-mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Escape → tutup window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        invoke('hide_spotlight_window').catch(console.error);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setIsLoading(true);
    try {
      if (detectedType === 'task') {
        const cleanTitle = text.replace(/^(\[ ?\]|todo:|task:|- \[ \])/i, '').trim();
        await captureItem({
          type: 'task',
          title: cleanTitle || 'Untitled Task',
          content: text,
          task: {
            priority: 'medium',
            completed: false,
            dueDate: null,
          },
        });
      } else if (detectedType === 'link') {
        const url = text.startsWith('http') ? text : `https://${text}`;
        let domain = '';
        let pageTitle = text;
        try {
          const u = new URL(url);
          domain = u.hostname.replace(/^www\./, '');
          pageTitle = domain;
        } catch {
          // ignore
        }
        await captureItem({
          type: 'link',
          title: pageTitle,
          content: url,
          link: {
            url,
            domain,
            pageTitle,
          },
        });
      } else {
        await captureItem({
          type: 'note',
          title: text.slice(0, 80),
          content: text.length > 80 ? text : '',
        });
      }

      setStatus('success');
      setInput('');
      // Tutup window setelah simpan
      setTimeout(() => {
        invoke('hide_spotlight_window').catch(console.error);
        setStatus('idle');
      }, 600);
    } catch (err) {
      console.error('Spotlight capture failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-white/20"
        style={{
          background: 'rgba(15, 15, 20, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Quick capture — note, todo: task, or https:// link..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {input.trim() && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10">
              {detectedType === 'task' && <CheckSquare className="w-3 h-3 text-emerald-400" />}
              {detectedType === 'link' && <Link2 className="w-3 h-3 text-sky-400" />}
              {detectedType === 'note' && <FileText className="w-3 h-3 text-amber-400" />}
              {detectedType}
            </span>
          )}
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="shrink-0 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
        {status === 'success' && (
          <div className="px-4 pb-2 text-xs text-emerald-400">✓ Saved successfully</div>
        )}
        {status === 'error' && (
          <div className="px-4 pb-2 text-xs text-red-400">✗ Failed to save, please try again</div>
        )}
        <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-zinc-600">
          <span><kbd className="font-mono">Enter</kbd> save</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

