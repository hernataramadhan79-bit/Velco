import React, { useState, useEffect, useMemo } from 'react';
import { useSettings } from '../../stores/settingsStore';
import { aiRouter, CloudAIProvider } from '../../services/ai';
import { db } from '../../services/database';
import { AIProviderType } from '../../types/settings';
import { AIModelInfo } from '../../types/ai';
import {
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
} from 'lucide-react';

function formatContextLength(ctx?: number): string | null {
  if (!ctx || ctx <= 0) return null;
  if (ctx >= 1000000) {
    const m = (ctx / 1000000).toFixed(ctx % 1000000 === 0 ? 0 : 1);
    return `${m}M context`;
  }
  if (ctx >= 1000) {
    return `${Math.round(ctx / 1000)}k context`;
  }
  return `${ctx} context`;
}

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useSettings();
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
  const [modelFilter, setModelFilter] = useState<'all' | 'free'>('free'); // default to free on OpenRouter
  const [modelSearch, setModelSearch] = useState('');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  // Fetch real-time available models from active provider
  const fetchLiveModels = async () => {
    setIsLoadingModels(true);
    try {
      const models = await aiRouter.getDetailedModels(settings);
      setDetailedModels(models);
    } catch (err) {
      console.warn('Failed to fetch live models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Test active AI connection
  const testAiConnection = async () => {
    setIsTestingAi(true);
    setTestResult(null);
    try {
      const active = aiRouter.getActiveInfo(settings);
      if (!active) {
        setTestResult({
          success: false,
          message: 'No active AI provider selected.',
        });
        return;
      }

      if (active.provider instanceof CloudAIProvider) {
        const res = await active.provider.testConnection();
        setTestResult(res);
        // Refresh models on successful connection test
        if (res.success) {
          fetchLiveModels();
        }
      } else {
        const isOnline = await active.provider.isAvailable();
        if (isOnline) {
          const models = await active.provider.getModels();
          setTestResult({
            success: true,
            message: `${active.name} is running and reachable (${models.length} models detected).`,
            models,
          });
          fetchLiveModels();
        } else {
          setTestResult({
            success: false,
            message: `Cannot reach ${active.name} at ${active.endpoint}. Ensure the local server is running.`,
          });
        }
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

  // Automatically fetch live models when switching to OpenRouter or enabling AI
  useEffect(() => {
    setTestResult(null);
    setDetailedModels([]);
    setModelSearch('');

    if (settings.aiEnabled) {
      if (settings.aiProvider === 'openrouter') {
        setModelFilter('free');
        fetchLiveModels();
      } else if (settings.aiProvider === 'gemini' || settings.aiProvider === 'openai') {
        setModelFilter('all');
        fetchLiveModels();
      } else if (settings.aiProvider === 'lmstudio' || settings.aiProvider === 'ollama') {
        setModelFilter('all');
        fetchLiveModels();
      }
    }
  }, [settings.aiProvider, settings.aiEnabled]);

  const handleExportBackup = async () => {
    try {
      const jsonStr = await db.exportBackup();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeinbox_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Application Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure local directories, theme preference, optional AI providers, and backups.
        </p>
      </div>

      {/* 1. Storage & Directories */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Local Storage Hierarchy</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Life Inbox stores all database records and binary attachments inside a dedicated folder
          on your machine.
        </p>

        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
            Data Root Directory
          </label>
          <input
            type="text"
            value={settings.storageDir}
            onChange={(e) => updateSettings({ storageDir: e.target.value })}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 database/
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 attachments/
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 thumbnails/
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 cache/
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 indexes/
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
            📁 logs/
          </div>
        </div>
      </section>

      {/* 2. Theme & Appearance */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Appearance</span>
        </div>

        <div className="flex items-center gap-3">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateSettings({ theme: t })}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                settings.theme === t
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t} Theme
            </button>
          ))}
        </div>
      </section>

      {/* 3. AI Enhancement Layer */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>AI Enhancement Layer</span>
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

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Privacy & Offline Standards:
          </span>{' '}
          Local AI runs 100% offline on your machine with zero data egress. Cloud AI platforms
          connect directly using your private API key — your credentials and requests are never
          proxied through any third-party telemetry.
        </div>

        {settings.aiEnabled && (
          <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs animate-in fade-in duration-150">
            {/* Provider Selector */}
            <div>
              <label className="font-semibold text-slate-800 dark:text-slate-200 block mb-2">
                Select AI Engine or Platform
              </label>

              {/* Group 1: Local AI */}
              <div className="space-y-1.5 mb-3">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Server className="w-3 h-3" /> Local Offline Engines (No API Key Required)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ aiProvider: 'lmstudio' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.aiProvider === 'lmstudio'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold">LM Studio / Local OpenAI</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      OpenAI-compatible local server (default: port 1234)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ aiProvider: 'ollama' })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.aiProvider === 'ollama'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-semibold">Ollama</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Local Ollama service daemon (default: port 11434)
                    </div>
                  </button>
                </div>
              </div>

              {/* Group 2: Cloud AI */}
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Cloud AI Platforms (Real-Time Dynamic Models)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'openrouter', name: 'OpenRouter', desc: '400+ Models with Free Options', highlight: true },
                    { id: 'gemini', name: 'Google Gemini', desc: 'Free Tier in AI Studio' },
                    { id: 'openai', name: 'OpenAI (ChatGPT)', desc: 'gpt-4o-mini, gpt-4o' },
                    { id: 'anthropic', name: 'Anthropic Claude', desc: 'claude-3-7, 3-5 Sonnet' },
                    { id: 'custom', name: 'Custom Endpoint', desc: 'Groq, DeepSeek, Together, etc.' },
                  ].map((p) => {
                    const isSelected = settings.aiProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => updateSettings({ aiProvider: p.id as AIProviderType })}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 shadow-xs ring-1 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {p.highlight && (
                          <span className="absolute -top-1.5 -right-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500 text-white shadow-xs">
                            FREE OPTIONS
                          </span>
                        )}
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {p.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Provider Configuration Forms */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-4">
              {/* LM Studio Config */}
              {settings.aiProvider === 'lmstudio' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        LM Studio Server URL
                      </label>
                      <input
                        type="text"
                        value={settings.lmstudioUrl}
                        onChange={(e) => updateSettings({ lmstudioUrl: e.target.value })}
                        placeholder="http://localhost:1234/v1"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
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
                        placeholder="e.g. qwen2.5-coder-7b-instruct"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={fetchLiveModels}
                      disabled={isLoadingModels}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      <span>Detect Loaded Models</span>
                    </button>
                  </div>

                  {detailedModels.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1.5 font-medium">
                        Click to select loaded model:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {detailedModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateSettings({ lmstudioModel: m.id })}
                            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] border cursor-pointer transition-colors ${
                              settings.lmstudioModel === m.id
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ollama Config */}
              {settings.aiProvider === 'ollama' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Ollama Daemon URL
                      </label>
                      <input
                        type="text"
                        value={settings.ollamaUrl}
                        onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                        placeholder="http://localhost:11434"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Active Model Tag
                      </label>
                      <input
                        type="text"
                        value={settings.ollamaModel}
                        onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                        placeholder="e.g. qwen2.5:latest or llama3.2:latest"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={fetchLiveModels}
                      disabled={isLoadingModels}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                      <span>Detect Installed Models</span>
                    </button>
                  </div>

                  {detailedModels.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1.5 font-medium">
                        Click to select installed model:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {detailedModels.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateSettings({ ollamaModel: m.id })}
                            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] border cursor-pointer transition-colors ${
                              settings.ollamaModel === m.id
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OpenRouter Config & Real-Time Model Browser */}
              {settings.aiProvider === 'openrouter' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-indigo-500" />
                        <span>OpenRouter API Key</span>
                      </label>
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Get OpenRouter Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.openrouterApiKey}
                        onChange={(e) => updateSettings({ openrouterApiKey: e.target.value })}
                        placeholder="sk-or-v1-..."
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Real-time Model Catalog for OpenRouter */}
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 space-y-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                          Live Models Catalog
                        </span>
                        {totalOpenRouterCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium border border-slate-200/70 dark:border-slate-700/60">
                            {totalOpenRouterCount} models online
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={fetchLiveModels}
                        disabled={isLoadingModels}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        <span>{isLoadingModels ? 'Checking live models...' : 'Refresh Catalog'}</span>
                      </button>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <button
                          type="button"
                          onClick={() => setModelFilter('free')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            modelFilter === 'free'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <span>Free Models Only</span>
                          {freeOpenRouterCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700/90 text-white">
                              {freeOpenRouterCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setModelFilter('all')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            modelFilter === 'all'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          All Models ({totalOpenRouterCount})
                        </button>
                      </div>

                      {/* Live Search Input */}
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          placeholder="Search models (e.g. free, llama, deepseek, gemini)..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Scrollable Model List */}
                    {isLoadingModels && detailedModels.length === 0 ? (
                      <div className="flex items-center justify-center p-8 text-xs text-slate-500 dark:text-slate-400 gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                        <span>Fetching real-time models catalog from OpenRouter...</span>
                      </div>
                    ) : filteredOpenRouterModels.length > 0 ? (
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {filteredOpenRouterModels.map((m) => {
                          const isSelected = settings.openrouterModel === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updateSettings({ openrouterModel: m.id })}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/60 shadow-xs ring-1 ring-blue-500/30'
                                  : 'border-slate-200 dark:border-slate-700/70 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                    {m.name}
                                  </span>

                                  {m.isFree ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 shadow-xs">
                                      FREE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/60">
                                      Standard
                                    </span>
                                  )}

                                  {formatContextLength(m.contextLength) && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                                      {formatContextLength(m.contextLength)}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {m.id}
                                </div>
                              </div>

                              {isSelected && (
                                <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">Active</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        No models found matching "{modelSearch}". Try searching for other terms or switch to "All Models".
                      </div>
                    )}

                    {/* Manual Override Input */}
                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/70">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1">
                        Active Selected Model ID (or customize manually):
                      </label>
                      <input
                        type="text"
                        value={settings.openrouterModel}
                        onChange={(e) => updateSettings({ openrouterModel: e.target.value })}
                        placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free"
                        className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gemini Config */}
              {settings.aiProvider === 'gemini' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-blue-500" />
                        <span>Google Gemini API Key</span>
                      </label>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Get Free Key from Google AI Studio <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.geminiApiKey}
                        onChange={(e) => updateSettings({ geminiApiKey: e.target.value })}
                        placeholder="AIzaSy..."
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Model Selection
                      </label>
                      <button
                        type="button"
                        onClick={fetchLiveModels}
                        disabled={isLoadingModels}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        <span>Fetch Live Models</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(detailedModels.length > 0
                        ? detailedModels
                        : [
                            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', isFree: true },
                            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', isFree: true },
                            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', isFree: true },
                          ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateSettings({ geminiModel: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer transition-colors flex items-center gap-1.5 ${
                            settings.geminiModel === m.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          <span>{m.id}</span>
                          <span className="text-[9px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            FREE TIER
                          </span>
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={settings.geminiModel}
                      onChange={(e) => updateSettings({ geminiModel: e.target.value })}
                      placeholder="Custom model ID"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* OpenAI Config */}
              {settings.aiProvider === 'openai' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-blue-500" />
                        <span>OpenAI API Key</span>
                      </label>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Get API Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.openaiApiKey}
                        onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
                        placeholder="sk-proj-... or sk-..."
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Model Selection
                      </label>
                      <button
                        type="button"
                        onClick={fetchLiveModels}
                        disabled={isLoadingModels}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        <span>Fetch Live Models</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(detailedModels.length > 0
                        ? detailedModels
                        : [
                            { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
                            { id: 'gpt-4o', name: 'gpt-4o' },
                            { id: 'o3-mini', name: 'o3-mini' },
                            { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo' },
                          ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateSettings({ openaiModel: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer transition-colors ${
                            settings.openaiModel === m.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {m.id} {m.id === 'gpt-4o-mini' && '(Recommended)'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={settings.openaiModel}
                      onChange={(e) => updateSettings({ openaiModel: e.target.value })}
                      placeholder="Custom model ID"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Anthropic Claude Config */}
              {settings.aiProvider === 'anthropic' && (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-500" />
                        <span>Anthropic API Key</span>
                      </label>
                      <a
                        href="https://console.anthropic.com/settings/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Get API Key from Anthropic <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.anthropicApiKey}
                        onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                        placeholder="sk-ant-api03-..."
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Model Selection
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Hybrid Reasoning)' },
                        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
                        { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
                        { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateSettings({ anthropicModel: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer transition-colors ${
                            settings.anthropicModel === m.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={settings.anthropicModel}
                      onChange={(e) => updateSettings({ anthropicModel: e.target.value })}
                      placeholder="Custom Claude model ID"
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Custom Endpoint Config */}
              {settings.aiProvider === 'custom' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                        Endpoint Base URL
                      </label>
                      <input
                        type="text"
                        value={settings.customApiUrl}
                        onChange={(e) => updateSettings({ customApiUrl: e.target.value })}
                        placeholder="https://api.groq.com/openai/v1"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
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
                        placeholder="e.g. llama-3.3-70b-versatile"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Authorization Key (Optional)
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.customApiKey}
                        onChange={(e) => updateSettings({ customApiKey: e.target.value })}
                        placeholder="Bearer token or API Key"
                        className="w-full pl-3 pr-10 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showApiKey ? 'Hide API key' : 'Show API key'}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Connection Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={testAiConnection}
                  disabled={isTestingAi}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
                  <span>{isTestingAi ? 'Testing Connection...' : 'Test Connection'}</span>
                </button>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Keys stored locally. Never uploaded to third-party telemetry.</span>
                </div>
              </div>

              {/* Connection Test Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl flex items-start gap-2.5 text-xs transition-all ${
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
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </div>
                    <div className="mt-0.5 opacity-90">{testResult.message}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 4. Backup & Export */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Local Backup & Portability</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Export your entire Life Inbox library (notes, tasks, links, tags, and metadata) as an
          offline JSON backup archive. No cloud account required.
        </p>

        {backupMessage && (
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs">
            {backupMessage}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleExportBackup}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportBackup}
            />
          </label>
        </div>
      </section>
    </div>
  );
};
