import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Command, X, Keyboard } from 'lucide-react';
import { modKey, formatShortcut } from '../../utils/platformUtils';

interface ShortcutCheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  key: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

export const ShortcutCheatSheetModal: React.FC<ShortcutCheatSheetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [appVersion, setAppVersion] = useState<string>('0.2.5');

  useEffect(() => {
    let isMounted = true;
    invoke<string>('get_app_version')
      .then((ver) => {
        if (isMounted && ver) setAppVersion(ver);
      })
      .catch((err) => console.debug('Failed to get app version:', err));
    return () => {
      isMounted = false;
    };
  }, []);

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

  if (!isOpen) return null;

  const groups: ShortcutGroup[] = [
    {
      title: 'Navigation & Layout',
      items: [
        { key: `${modKey} + B`, description: 'Toggle Left Navigation Sidebar' },
        { key: `${modKey} + K`, description: 'Open Global Search / Command Palette' },
        { key: `${modKey} + J`, description: 'Toggle The Foundry (AI Workstation)' },
        { key: 'Esc', description: 'Close active modal, drawer, or search' },
      ],
    },
    {
      title: 'Capture & Creation',
      items: [
        { key: `${modKey} + Enter`, description: 'Save note, task, or link capture' },
        { key: 'Tab', description: 'Navigate through inputs and items' },
      ],
    },
    {
      title: 'System & Intelligence',
      items: [
        { key: '?', description: 'Toggle this Keyboard Shortcuts cheat sheet' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {group.title}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05] rounded-lg border border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#101014]/50 overflow-hidden">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-700 dark:text-zinc-300">
                      {item.description}
                    </span>
                    <kbd className="px-2 py-0.5 rounded bg-white dark:bg-white/[0.08] font-mono text-[11px] font-semibold text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-white/[0.1] shadow-2xs">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-[#101014] border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
          <span>Press <kbd className="font-mono text-[10px] px-1 py-0.5 rounded bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08]">Esc</kbd> anytime to dismiss</span>
          <span className="font-mono">Velco v{appVersion}</span>
        </div>
      </div>
    </div>
  );
};
