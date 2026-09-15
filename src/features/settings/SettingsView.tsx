import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../stores/settingsStore';
import {
  ArrowLeft,
  Folder,
  Palette,
  Shield,
  Cpu,
  Info,
} from 'lucide-react';

import { AiSection } from './sections/AiSection';
import { StorageSection } from './sections/StorageSection';
import { BackupSection } from './sections/BackupSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { AboutSection } from './sections/AboutSection';

export type SettingsSection = 'ai' | 'storage' | 'backup' | 'appearance' | 'about';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai');
  const [appVersion, setAppVersion] = useState<string>('0.2.5');

  useEffect(() => {
    let isMounted = true;
    invoke<string>('get_app_version')
      .then((ver) => {
        if (isMounted && ver) {
          setAppVersion(ver);
        }
      })
      .catch((err) => {
        console.debug('Failed to get app version:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Allow Escape key to return to workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const sections = useMemo(
    () => [
      {
        id: 'ai' as SettingsSection,
        label: 'AI & Intelligence',
        icon: Cpu,
        badge: settings.aiEnabled ? 'Active' : 'Off',
      },
      {
        id: 'storage' as SettingsSection,
        label: 'Storage & Hierarchy',
        icon: Folder,
      },
      {
        id: 'backup' as SettingsSection,
        label: 'Backup & Safety Net',
        icon: Shield,
      },
      {
        id: 'appearance' as SettingsSection,
        label: 'Appearance & UI',
        icon: Palette,
        badge: settings.theme,
      },
      {
        id: 'about' as SettingsSection,
        label: 'System & Updates',
        icon: Info,
      },
    ],
    [settings.aiEnabled, settings.theme]
  );

  const activeSectionItem = useMemo(
    () => sections.find((s) => s.id === activeSection) || sections[0],
    [sections, activeSection]
  );

  return (
    <div className="flex h-full w-full max-w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 overflow-hidden font-sans select-none">
      {/* 1. INDUSTRIAL SETTINGS SIDEBAR */}
      <aside className="w-60 lg:w-64 shrink-0 border-r border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d0d10] flex flex-col justify-between p-3">
        <div className="space-y-3">
          {/* Back button to workspace */}
          <button
            onClick={onBack}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-slate-200 dark:border-white/[0.08] shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Back to Workspace</span>
            <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400">
              Esc
            </kbd>
          </button>

          {/* Section Heading */}
          <div className="px-3 pt-1">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Settings &amp; Workstation
            </h2>
          </div>

          {/* Clean Section Navigation */}
          <nav className="space-y-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white dark:bg-white/[0.1] dark:text-white border border-transparent dark:border-white/[0.1] shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white dark:text-white' : 'text-slate-400 dark:text-zinc-500'}`} />
                    <span>{sec.label}</span>
                  </div>
                  {sec.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded capitalize ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer telemetry */}
        <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-zinc-500 font-mono border-t border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
          <span>Velco Desktop</span>
          <span className="font-semibold text-slate-600 dark:text-zinc-400">v{appVersion}</span>
        </div>
      </aside>

      {/* 2. FOCUSED SETTINGS WORKSPACE */}
      <div className="flex-1 flex flex-col h-full min-w-0 max-w-full overflow-hidden bg-slate-100/60 dark:bg-[#09090b]">
        {/* Top Header */}
        <header className="h-12 border-b border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#0d0d10] px-6 flex items-center shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
              {activeSectionItem.label}
            </h1>
          </div>
        </header>

        {/* Scrollable Section Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-12 py-8">
          <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {activeSection === 'ai' && <AiSection />}
            {activeSection === 'storage' && <StorageSection />}
            {activeSection === 'backup' && <BackupSection />}
            {activeSection === 'appearance' && <AppearanceSection />}
            {activeSection === 'about' && <AboutSection />}
          </div>
        </main>
      </div>
    </div>
  );
};
