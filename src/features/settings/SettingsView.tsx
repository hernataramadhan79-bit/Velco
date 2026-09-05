import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { aiService } from '../../services/ai';
import { db } from '../../services/database';
import { AIProviderType } from '../../types/settings';
import { AIModelInfo } from '../../types/ai';
import { PriorityLevel } from '../../types/item';
import {
  ArrowLeft,
  X,
  Folder,
  Palette,
  Shield,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Globe,
  Server,
  Lock,
  Search,
  Sparkles,
  Info,
  Sun,
  Moon,
  Laptop,
  Layers,
  HardDrive,
  Sliders,
  Check,
} from 'lucide-react';

export type SettingsSection = 'ai' | 'storage' | 'backup' | 'appearance' | 'about';

interface SettingsViewProps {
  onBack: () => void;
}

function formatContextLength(ctx?: number): string | null {
  if (!ctx || ctx <= 0) return null;
  if (ctx >= 1000000) {
    const m = (ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1);
    return `${m}M ctx`;
  }
  if (ctx >= 1000) {
    return `${Math.round(ctx / 1000)}k ctx`;
  }
  return `${ctx} ctx`;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { settings, updateSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai');

  // AI Connection State
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    models?: string[];
  } | null>(null);

  // Live real-time models catalog
  const [detailedModels, setDetailedModels] = useState<AIModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFilter, setModelFilter] = useState<'all' | 'free'>('free');
  const [modelSearch, setModelSearch] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

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
        label: 'Backup & Restore',
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
        label: 'System & Shortcuts',
        icon: Info,
      },
    ],
    [settings.aiEnabled, settings.theme]
  );

  const activeSectionItem = useMemo(
    () => sections.find((s) => s.id === activeSection) || sections[0],
    [sections, activeSection]
  );

  const getProviderModel = useCallback((): string => {
    switch (settings.aiProvider) {
      case 'ollama': return settings.ollamaModel || 'qwen2.5:latest';
      case 'lmstudio': return settings.lmstudioModel || 'qwen2.5-coder-7b-instruct';
      case 'openai': return settings.openaiModel || 'gpt-4o-mini';
      case 'gemini': return settings.geminiModel || 'gemini-1.5-flash';
      case 'anthropic': return settings.anthropicModel || 'claude-3-5-haiku-20241022';
      case 'openrouter': return settings.openrouterModel || 'openai/gpt-4o-mini';
      case 'custom': return settings.customModel || '';
      default: return '';
    }
  }, [
    settings.aiProvider,
    settings.ollamaModel,
    settings.lmstudioModel,
    settings.openaiModel,
    settings.geminiModel,
    settings.anthropicModel,
    settings.openrouterModel,
    settings.customModel,
  ]);

  const getProviderBaseUrl = useCallback((): string => {
    switch (settings.aiProvider) {
      case 'ollama': return settings.ollamaUrl || 'http://localhost:11434';
      case 'lmstudio': return settings.lmstudioUrl || 'http://localhost:1234/v1';
      case 'openai': return 'https://api.openai.com/v1';
      case 'gemini': return 'https://generativelanguage.googleapis.com/v1beta/openai';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'openrouter': return 'https://openrouter.ai/api/v1';
      case 'custom': return settings.customApiUrl || '';
      default: return '';
    }
  }, [settings.aiProvider, settings.ollamaUrl, settings.lmstudioUrl, settings.customApiUrl]);

  const getProviderApiKey = useCallback((): string | undefined => {
    switch (settings.aiProvider) {
      case 'openai': return settings.openaiApiKey || undefined;
      case 'gemini': return settings.geminiApiKey || undefined;
      case 'anthropic': return settings.anthropicApiKey || undefined;
      case 'openrouter': return settings.openrouterApiKey || undefined;
      case 'custom': return settings.customApiKey || undefined;
      default: return undefined;
    }
  }, [
    settings.aiProvider,
    settings.openaiApiKey,
    settings.geminiApiKey,
    settings.anthropicApiKey,
    settings.openrouterApiKey,
    settings.customApiKey,
  ]);

  // Fetch real-time available models from active provider
  const fetchLiveModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const baseUrl = getProviderBaseUrl();
      const apiKey = getProviderApiKey();
      const result = await aiService.testConnection(
        baseUrl,
        apiKey,
        settings.aiProvider,
        getProviderModel()
      );
      if (result.models && result.models.length > 0) {
        setDetailedModels(result.models.map((m) => ({ id: m, name: m })));
      }
    } catch (err) {
      console.warn('Failed to fetch live models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, [getProviderBaseUrl, getProviderApiKey, settings.aiProvider, getProviderModel]);

  // Test active AI connection
  const testAiConnection = async () => {
    setIsTestingAi(true);
    setTestResult(null);
    try {
      const baseUrl = getProviderBaseUrl();
      const apiKey = getProviderApiKey();

      if (!baseUrl && !['ollama', 'lmstudio'].includes(settings.aiProvider)) {
        setTestResult({ success: false, message: 'No AI provider base URL configured.' });
        return;
      }

      const result = await aiService.testConnection(
        baseUrl,
        apiKey,
        settings.aiProvider,
        getProviderModel()
      );
      setTestResult(result);
      if (result.success) {
        fetchLiveModels();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed.',
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  useEffect(() => {
    if (settings.aiEnabled && activeSection === 'ai') {
      fetchLiveModels();
    }
  }, [settings.aiProvider, settings.aiEnabled, activeSection, fetchLiveModels]);

  const handleExportBackup = async () => {
    try {
      const jsonStr = await db.exportBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `velco_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupMessage('Backup exported successfully.');
      setTimeout(() => setBackupMessage(null), 4000);
    } catch (err: any) {
      setBackupMessage(`Export failed: ${err.message}`);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const count = await db.importBackup(text);
        setBackupMessage(`Imported ${count} items successfully. Refreshing view...`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        setBackupMessage(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Filtered OpenRouter models
  const filteredOpenRouterModels = useMemo(() => {
    return detailedModels.filter((m) => {
      if (modelFilter === 'free' && !m.isFree) return false;
      if (!modelSearch.trim()) return true;
      const q = modelSearch.toLowerCase().trim();
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    });
  }, [detailedModels, modelFilter, modelSearch]);

  const totalOpenRouterCount = detailedModels.length;
  const freeOpenRouterCount = useMemo(
    () => detailedModels.filter((m) => m.isFree).length,
    [detailedModels]
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans select-none">
      {/* 1. SIMPLE, STREAMLINED SETTINGS SIDEBAR */}
      <aside className="w-60 lg:w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col justify-between p-3.5">
        <div className="space-y-3">
          {/* Back button to workspace */}
          <button
            onClick={onBack}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-800 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to Workspace</span>
            <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
              Esc
            </kbd>
          </button>

          {/* Section Heading */}
          <div className="px-3 pt-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Settings
            </h2>
          </div>

          {/* Simple Clean Section List */}
          <nav className="space-y-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{sec.label}</span>
                  </div>
                  {sec.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full capitalize ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
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

        {/* Footer info */}
        <div className="px-3 py-2 text-[11px] text-slate-400 font-mono border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <span>Velco Desktop</span>
          <span className="font-bold">v0.1.0</span>
        </div>
      </aside>

      {/* 2. FOCUSED SETTINGS CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-100/60 dark:bg-slate-900/40">
        {/* Top Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {activeSectionItem.label}
            </h1>
          </div>
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Section Content */}
        <main className="flex-1 overflow-y-auto px-6 sm:px-12 py-8">
          <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {/* SECTION: AI & INTELLIGENCE */}
            {activeSection === 'ai' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                {/* Master Switch Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      <span>Enable AI Features</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Powers The Foundry synthesis recipes, auto-tagging, and contextual summarization.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.aiEnabled}
                      onChange={(e) => updateSettings({ aiEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {settings.aiEnabled ? (
                  <>
                    {/* Select Engine Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Select AI Engine
                      </div>

                      {/* Local vs Cloud Engine selection */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5" />
                          <span>Local Offline Engines</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            { id: 'lmstudio', name: 'LM Studio / Local OpenAI', port: 'port 1234' },
                            { id: 'ollama', name: 'Ollama Daemon', port: 'port 11434' },
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => updateSettings({ aiProvider: p.id as AIProviderType })}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                settings.aiProvider === p.id
                                  ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-semibold text-xs">{p.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.port}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Cloud AI Platforms</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'openrouter', name: 'OpenRouter', badge: 'FREE OPTIONS' },
                            { id: 'gemini', name: 'Google Gemini', badge: 'FREE TIER' },
                            { id: 'openai', name: 'OpenAI' },
                            { id: 'anthropic', name: 'Anthropic Claude' },
                            { id: 'custom', name: 'Custom' },
                          ].map((p) => {
                            const isSelected = settings.aiProvider === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => updateSettings({ aiProvider: p.id as AIProviderType })}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                                  isSelected
                                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                }`}
                              >
                                {p.badge && (
                                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500 text-white">
                                    {p.badge}
                                  </span>
                                )}
                                <div className="font-semibold text-xs">{p.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Active Provider Config */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-blue-500" />
                        <span>Configure {settings.aiProvider}</span>
                      </div>

                      {/* OpenRouter */}
                      {settings.aiProvider === 'openrouter' && (
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-1 text-xs">
                              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-indigo-500" />
                                <span>OpenRouter API Key</span>
                              </label>
                              <a
                                href="https://openrouter.ai/keys"
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                Get Key <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="relative">
                              <input
                                type={showApiKey ? 'text' : 'password'}
                                value={settings.openrouterApiKey}
                                onChange={(e) => updateSettings({ openrouterApiKey: e.target.value })}
                                placeholder="sk-or-v1-..."
                                className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          {/* Live Models Browser */}
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Live Models Catalog</span>
                              </span>
                              <button
                                type="button"
                                onClick={fetchLiveModels}
                                disabled={isLoadingModels}
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                              >
                                <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                                <span>{isLoadingModels ? 'Fetching...' : 'Refresh'}</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setModelFilter('free')}
                                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                                    modelFilter === 'free'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  Free ({freeOpenRouterCount})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setModelFilter('all')}
                                  className={`px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer ${
                                    modelFilter === 'all'
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  All ({totalOpenRouterCount})
                                </button>
                              </div>

                              <div className="relative flex-1">
                                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={modelSearch}
                                  onChange={(e) => setModelSearch(e.target.value)}
                                  placeholder="Filter models..."
                                  className="w-full pl-7 pr-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                              {filteredOpenRouterModels.map((m) => {
                                const isSelected = settings.openrouterModel === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => updateSettings({ openrouterModel: m.id })}
                                    className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 shadow-xs'
                                        : 'border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                          {m.name}
                                        </span>
                                        {m.isFree && (
                                          <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                            FREE
                                          </span>
                                        )}
                                        {formatContextLength(m.contextLength) && (
                                          <span className="text-[9px] font-mono text-slate-400">
                                            {formatContextLength(m.contextLength)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400 truncate">
                                        {m.id}
                                      </div>
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>

                            <div>
                              <input
                                type="text"
                                value={settings.openrouterModel}
                                onChange={(e) => updateSettings({ openrouterModel: e.target.value })}
                                placeholder="Custom Model ID"
                                className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Ollama */}
                      {settings.aiProvider === 'ollama' && (
                        <div className="space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                Ollama URL
                              </label>
                              <input
                                type="text"
                                value={settings.ollamaUrl}
                                onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                                placeholder="http://localhost:11434"
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                Model Tag
                              </label>
                              <input
                                type="text"
                                value={settings.ollamaModel}
                                onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                                placeholder="qwen2.5:latest"
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={fetchLiveModels}
                            disabled={isLoadingModels}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                            <span>Detect Installed Ollama Models</span>
                          </button>
                        </div>
                      )}

                      {/* LM Studio */}
                      {settings.aiProvider === 'lmstudio' && (
                        <div className="space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                LM Studio URL
                              </label>
                              <input
                                type="text"
                                value={settings.lmstudioUrl}
                                onChange={(e) => updateSettings({ lmstudioUrl: e.target.value })}
                                placeholder="http://localhost:1234/v1"
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                Loaded Model Identifier
                              </label>
                              <input
                                type="text"
                                value={settings.lmstudioModel}
                                onChange={(e) => updateSettings({ lmstudioModel: e.target.value })}
                                placeholder="qwen2.5-coder-7b-instruct"
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={fetchLiveModels}
                            disabled={isLoadingModels}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                            <span>Detect Loaded Models</span>
                          </button>
                        </div>
                      )}

                      {/* Gemini */}
                      {settings.aiProvider === 'gemini' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-semibold text-slate-700 dark:text-slate-300">
                                Google Gemini API Key
                              </label>
                              <a
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-[11px]"
                              >
                                Get Free Key
                              </a>
                            </div>
                            <input
                              type="password"
                              value={settings.geminiApiKey}
                              onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                              placeholder="AIzaSy..."
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateSettings({ geminiModel: m })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono border cursor-pointer ${
                                  settings.geminiModel === m
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* OpenAI */}
                      {settings.aiProvider === 'openai' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              OpenAI API Key
                            </label>
                            <input
                              type="password"
                              value={settings.openaiApiKey}
                              onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                              placeholder="sk-..."
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {['gpt-4o-mini', 'gpt-4o', 'o3-mini'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateSettings({ openaiModel: m })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono border cursor-pointer ${
                                  settings.openaiModel === m
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Anthropic */}
                      {settings.aiProvider === 'anthropic' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              Anthropic API Key
                            </label>
                            <input
                              type="password"
                              value={settings.anthropicApiKey}
                              onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                              placeholder="sk-ant-api03-..."
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => updateSettings({ anthropicModel: m })}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono border cursor-pointer ${
                                  settings.anthropicModel === m
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {m.split('-')[0]} {m.split('-')[1]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom */}
                      {settings.aiProvider === 'custom' && (
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              Endpoint URL
                            </label>
                            <input
                              type="text"
                              value={settings.customApiUrl}
                              onChange={(e) => updateSettings({ customApiUrl: e.target.value })}
                              placeholder="https://api.groq.com/openai/v1"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              Model Name
                            </label>
                            <input
                              type="text"
                              value={settings.customModel}
                              onChange={(e) => updateSettings({ customModel: e.target.value })}
                              placeholder="llama-3.3-70b-versatile"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Connection Test Action */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={testAiConnection}
                          disabled={isTestingAi}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
                          <span>{isTestingAi ? 'Testing...' : 'Test Connection'}</span>
                        </button>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-500" />
                          <span>Keys stored locally</span>
                        </div>
                      </div>

                      {testResult && (
                        <div
                          className={`p-3 rounded-xl flex items-start gap-2 text-xs ${
                            testResult.success
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-semibold">
                              {testResult.success ? 'Operational' : 'Failed'}
                            </div>
                            <div className="text-[11px] opacity-90">{testResult.message}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <Cpu className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      AI Features Disabled
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Enable the switch above to connect local offline models or cloud frontier APIs.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SECTION: STORAGE & HIERARCHY */}
            {activeSection === 'storage' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Data Root Directory</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Velco stores all SQLite databases and attachments on your local file system.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Directory Path
                    </label>
                    <input
                      type="text"
                      value={settings.storageDir}
                      onChange={(e) => updateSettings({ storageDir: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Subdirectory Hierarchy</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-mono font-bold text-blue-600 block mb-0.5">📁 database/</span>
                      <span className="text-[11px] text-slate-400">SQLite file `velco.db` with FTS5 search index.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-mono font-bold text-emerald-600 block mb-0.5">📁 attachments/</span>
                      <span className="text-[11px] text-slate-400">Imported files, PDFs, and images with SHA-256 hash.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-mono font-bold text-purple-600 block mb-0.5">📁 thumbnails/</span>
                      <span className="text-[11px] text-slate-400">Cached image thumbnails for fast rendering.</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="font-mono font-bold text-amber-600 block mb-0.5">📁 cache/ & logs/</span>
                      <span className="text-[11px] text-slate-400">Temporary processing data and diagnostic logs.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: BACKUP & RESTORE */}
            {activeSection === 'backup' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                {backupMessage && (
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
                    {backupMessage}
                  </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Export Local Backup</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Downloads an unencrypted, complete JSON backup containing all items, tasks, notes, links, tags, and AI synthesis history.
                  </p>
                  <button
                    onClick={handleExportBackup}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON Backup</span>
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Restore from Backup</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Select a previously exported JSON backup to restore relational records and repopulate the FTS5 search index.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Backup File (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportBackup}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* SECTION: APPEARANCE & UI */}
            {activeSection === 'appearance' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Theme Mode
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'system', label: 'System Sync', icon: Laptop },
                      { id: 'light', label: 'Light Mode', icon: Sun },
                      { id: 'dark', label: 'Dark Mode', icon: Moon },
                    ].map((t) => {
                      const Icon = t.icon;
                      const isSelected = settings.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateSettings({ theme: t.id as any })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-semibold">{t.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Default Task Priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['low', 'medium', 'high', 'urgent'] as PriorityLevel[]).map((p) => {
                      const isSelected = settings.defaultTaskPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateSettings({ defaultTaskPriority: p })}
                          className={`px-3.5 py-1.5 rounded-xl text-xs capitalize font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION: SYSTEM & ABOUT */}
            {activeSection === 'about' && (
              <div className="space-y-6 animate-in fade-in duration-100">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Velco Desktop
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Local-First Context-Bound AI Workstation
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold border border-blue-200 dark:border-blue-800">
                    v0.1.0
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Keyboard Shortcuts
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {[
                      { key: 'Ctrl + B', label: 'Toggle Sidebar' },
                      { key: 'Ctrl + K', label: 'Global Search' },
                      { key: 'Ctrl + J', label: 'Toggle The Foundry' },
                      { key: 'Ctrl + Enter', label: 'Save capture' },
                      { key: 'Escape', label: 'Close modals / search' },
                    ].map((s, idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-400">{s.label}</span>
                        <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {s.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
